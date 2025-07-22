import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  BlockStack,
  DataTable,
  Badge,
  InlineStack,
  TextField,
  Select,
  EmptyState,
  Pagination,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "~/shopify.server";
import drizzleDb from "../db.server";
import { generationsTable, type Generation } from "~/db/schema";
import { eq, desc, count } from "drizzle-orm";
import { useState, useMemo } from "react";
import { HoverImagePreview } from "~/components/HoverImagePreview";
import { ImageModal } from "~/components/ImageModal";

const DEBUG_REQUESTS = process.env.DEBUG_REQUESTS === 'true' || process.env.NODE_ENV === 'development';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const pageParam = url.searchParams.get("page");
  const page = pageParam ? parseInt(pageParam, 10) : 1;
  const pageSize = 50;
  const offset = (page - 1) * pageSize;

  if (DEBUG_REQUESTS) {
    console.log(`[GENERATIONS] Loading generations page: ${url.pathname}, page: ${page}, pageSize: ${pageSize}`);
  }

  const { session } = await authenticate.admin(request);

  if (DEBUG_REQUESTS) {
    console.log(`[GENERATIONS] Shop: ${session.shop}`);
  }

  // Get total count for pagination
  const countResult = await drizzleDb
    .select({ count: count() })
    .from(generationsTable)
    .where(eq(generationsTable.shopId, session.shop));

  // Add null check to handle case when countResult is empty
  const totalCount = countResult[0] ? Number(countResult[0].count) : 0;

  // Fetch paginated generations for this shop
  const generations = await drizzleDb
    .select()
    .from(generationsTable)
    .where(eq(generationsTable.shopId, session.shop))
    .orderBy(desc(generationsTable.createdAt))
    .limit(pageSize)
    .offset(offset);

  if (DEBUG_REQUESTS) {
    console.log(`[GENERATIONS] Found ${generations.length} generations for shop ${session.shop} (page ${page} of ${Math.ceil(totalCount / pageSize)})`);
  }

  return {
    generations,
    shop: session.shop,
    pagination: {
      currentPage: page,
      pageSize,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
    },
  };
};

export default function GenerationsPage() {
  const { generations, pagination } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modalImage, setModalImage] = useState<{ url: string; alt: string } | null>(null);
  const [currentPage, setCurrentPage] = useState(pagination.currentPage);

  // Page change handler
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    navigate(`?page=${newPage}`);
  };

  // Custom handlers for filters that reset pagination
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    // Reset to page 1 when search changes
    if (currentPage !== 1) {
      setCurrentPage(1);
      navigate('?page=1');
    }
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    // Reset to page 1 when filter changes
    if (currentPage !== 1) {
      setCurrentPage(1);
      navigate('?page=1');
    }
  };

  // Modal handlers
  const handleImageClick = (imageUrl: string, altText: string) => {
    setModalImage({ url: imageUrl, alt: altText });
  };

  const handleModalClose = () => {
    setModalImage(null);
  };

  // Helper function to render status badges
  const renderStatusBadge = (status: string) => {
    const statusMap = {
      completed: "success",
      processing: "info",
      pending: "warning",
      failed: "critical",
    } as const;

    return <Badge tone={statusMap[status as keyof typeof statusMap] || "info"}>{status}</Badge>;
  };

  // Helper function to render image thumbnails with hover preview
  const renderImageThumbnail = (imageUrl: string | null, altText: string) => {
    return (
      <HoverImagePreview
        imageUrl={imageUrl}
        altText={altText}
        fallbackText="No image"
        onImageClick={handleImageClick}
      />
    );
  };

  // Filter generations based on search and status
  const filteredGenerations = useMemo(() => {
    // When using server-side pagination, we should only filter the current page
    return generations.filter((gen: Generation) => {
      const matchesSearch = !searchQuery ||
        (gen.customerId && gen.customerId.toLowerCase().includes(searchQuery.toLowerCase())) ||
        gen.aiPromptUsed.toLowerCase().includes(searchQuery.toLowerCase()) ||
        gen.generationType.toLowerCase().includes(searchQuery.toLowerCase()) ||
        gen.id.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === "all" || gen.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [generations, searchQuery, statusFilter]);

  // Prepare table data
  const tableRows = filteredGenerations.map((gen: Generation) => {
    // Determine output image based on generation type and status
    const outputImageUrl = gen.generationType === 'final' && gen.finalImageUrl
      ? gen.finalImageUrl
      : gen.previewImageUrl;

    return [
      gen.id.substring(0, 12) + "...",
      renderImageThumbnail(gen.inputImageUrl, "Input image"),
      renderImageThumbnail(outputImageUrl, "Output image"),
      gen.customerId?.replace("gid://shopify/Customer/", "Customer ") || "Anonymous",
      gen.generationType.charAt(0).toUpperCase() + gen.generationType.slice(1),
      gen.aiPromptUsed.substring(0, 40) + (gen.aiPromptUsed.length > 40 ? "..." : ""),
      renderStatusBadge(gen.status || "pending"),
      new Date(gen.createdAt).toLocaleString(),
      gen.status === 'completed' ? new Date(gen.updatedAt).toLocaleString() : "-",
      gen.errorMessage || "-",
    ];
  });

  // Status options for filter
  const statusOptions = [
    { label: "All Statuses", value: "all" },
    { label: "Pending", value: "pending" },
    { label: "Processing", value: "processing" },
    { label: "Completed", value: "completed" },
    { label: "Failed", value: "failed" },
  ];

  // Calculate stats
  const stats = {
    total: generations.length,
    completed: generations.filter(g => g.status === 'completed').length,
    processing: generations.filter(g => g.status === 'processing').length,
    pending: generations.filter(g => g.status === 'pending').length,
    failed: generations.filter(g => g.status === 'failed').length,
  };

  return (
    <Page>
      <TitleBar title="Generations" />
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <BlockStack gap="500">
              {/* Header with Stats */}
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingLg">
                    AI Pet Portrait Generations
                  </Text>


                  {/* Quick Stats */}
                  <Layout>
                    <Layout.Section variant="oneThird">
                      <Card>
                        <BlockStack gap="200">
                          <Text as="h3" variant="headingMd" tone="subdued">Total</Text>
                          <Text as="p" variant="headingXl">{stats.total}</Text>
                        </BlockStack>
                      </Card>
                    </Layout.Section>
                    <Layout.Section variant="oneThird">
                      <Card>
                        <BlockStack gap="200">
                          <Text as="h3" variant="headingMd" tone="subdued">Completed</Text>
                          <Text as="p" variant="headingXl" tone="success">{stats.completed}</Text>
                        </BlockStack>
                      </Card>
                    </Layout.Section>
                    <Layout.Section variant="oneThird">
                      <Card>
                        <BlockStack gap="200">
                          <Text as="h3" variant="headingMd" tone="subdued">Processing</Text>
                          <Text as="p" variant="headingXl">{stats.processing + stats.pending}</Text>
                        </BlockStack>
                      </Card>
                    </Layout.Section>
                  </Layout>
                  <Layout>
                    <Layout.Section variant="oneHalf">
                      <Card>
                        <BlockStack gap="200">
                          <Text as="h3" variant="headingMd" tone="subdued">Failed</Text>
                          <Text as="p" variant="headingXl" tone="critical">{stats.failed}</Text>
                        </BlockStack>
                      </Card>
                    </Layout.Section>
                  </Layout>
                </BlockStack>
              </Card>

              {/* Filters */}
              <Card>
                <BlockStack gap="400">
                  <Text as="h3" variant="headingMd">
                    Filters
                  </Text>
                  <Layout>
                    <Layout.Section variant="oneHalf">
                      <TextField
                        label="Search generations"
                        value={searchQuery}
                        onChange={handleSearchChange}
                        placeholder="Search by customer, AI prompt, type, or ID..."
                        clearButton
                        onClearButtonClick={() => handleSearchChange("")}
                        autoComplete="off"
                      />
                    </Layout.Section>
                    <Layout.Section variant="oneHalf">
                      <Select
                        label="Status"
                        options={statusOptions}
                        value={statusFilter}
                        onChange={handleStatusFilterChange}
                      />
                    </Layout.Section>
                  </Layout>
                </BlockStack>
              </Card>

              {/* Generations Table */}
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between">
                    <Text as="h3" variant="headingMd">
                      All Generations ({filteredGenerations.length})
                    </Text>
                  </InlineStack>

                  {filteredGenerations.length === 0 ? (
                    <EmptyState
                      heading={generations.length === 0 ? "No generations yet" : "No generations match your filters"}
                      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                    >
                      {generations.length === 0 ? (
                        <p>Start creating AI-generated pet portraits to see them here.</p>
                      ) : (
                        <p>Try adjusting your search or filters to find what you're looking for.</p>
                      )}
                    </EmptyState>
                  ) : (
                    <DataTable
                      columnContentTypes={[
                        'text', // ID
                        'text', // Input Image
                        'text', // Output Image
                        'text', // Customer
                        'text', // Type
                        'text', // AI Prompt
                        'text', // Status
                        'text', // Created
                        'text', // Updated
                        'text', // Error Message
                      ]}
                      headings={[
                        'Generation ID',
                        'Input Image',
                        'Output Image',
                        'Customer',
                        'Type',
                        'AI Prompt',
                        'Status',
                        'Created At',
                        'Updated At',
                        'Error Message',
                      ]}
                      rows={tableRows}
                      footerContent={
                        <BlockStack>
                          <Text as={'span'}>
                            {filteredGenerations.length !== generations.length
                              ? `Showing ${filteredGenerations.length} of ${generations.length} generations`
                              : `Showing page ${currentPage} of ${pagination.totalPages} (${pagination.totalCount} total generations)`}
                          </Text>
                          <Pagination
                            hasPrevious={currentPage > 1}
                            onPrevious={() => handlePageChange(currentPage - 1)}
                            hasNext={currentPage < pagination.totalPages}
                            onNext={() => handlePageChange(currentPage + 1)}
                          />
                        </BlockStack>
                      }
                    />
                  )}
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>

      {/* Image Modal */}
      <ImageModal
        imageUrl={modalImage?.url || null}
        altText={modalImage?.alt || null}
        isOpen={!!modalImage}
        onClose={handleModalClose}
      />
    </Page>
  );
}
