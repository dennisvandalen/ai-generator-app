import { useState } from "react";
import { Button } from "@shopify/polaris";
import { SetupGuide } from "./SetupGuide";

// Define interfaces for the component
interface ButtonProps {
  url?: string;
  external?: boolean;
  onAction?: () => void;
}

interface ButtonConfig {
  content: string;
  props: ButtonProps;
}

interface ItemImage {
  url: string;
  alt?: string;
}

interface SetupItem {
  id: number;
  title: string;
  description: string;
  image: ItemImage;
  complete: boolean;
  primaryButton: ButtonConfig;
  secondaryButton?: ButtonConfig;
}

export const Onboarding = (): JSX.Element => {
  const [showGuide, setShowGuide] = useState<boolean>(true);
  const [items, setItems] = useState<SetupItem[]>(ITEMS);

  // Example of step complete handler, adjust for your use case
  const onStepComplete = async (id: number): Promise<void> => {
    try {
      // API call to update completion state in DB, etc.
      await new Promise<void>((res) =>
        setTimeout(() => {
          res();
        }, 1000)
      );

      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, complete: !item.complete } : item)));
    } catch (e) {
      console.error(e);
    }
  };

  if (!showGuide) return <Button onClick={() => setShowGuide(true)}>Show Setup Guide</Button>;

  return (
    <div className="max-w-[60rem] m-auto">
      <SetupGuide
        onDismiss={() => {
          setShowGuide(false);
          setItems(ITEMS);
        }}
        onStepComplete={onStepComplete}
        items={items}
      />
    </div>
  );
};

// EXAMPLE DATA - COMPONENT API
const ITEMS: SetupItem[] = [
  {
    id: 0,
    title: "Add your first product",
    description:
      "If checking out takes longer than 30 seconds, half of all shoppers quit. Let your customers check out quickly with a one-step payment solution.",
    image: {
      url: "https://cdn.shopify.com/shopifycloud/shopify/assets/admin/home/onboarding/shop_pay_task-70830ae12d3f01fed1da23e607dc58bc726325144c29f96c949baca598ee3ef6.svg",
      alt: "Illustration highlighting ShopPay integration",
    },
    complete: false,
    primaryButton: {
      content: "Add product",
      props: {
        url: "https://www.example.com",
        external: true,
      },
    },
    secondaryButton: {
      content: "Import products",
      props: {
        url: "https://www.example.com",
        external: true,
      },
    },
  },
  {
    id: 1,
    title: "Share your online store",
    description:
      "Drive awareness and traffic by sharing your store via SMS and email with your closest network, and on communities like Instagram, TikTok, Facebook, and Reddit.",
    image: {
      url: "https://cdn.shopify.com/shopifycloud/shopify/assets/admin/home/onboarding/detail-images/home-onboard-share-store-b265242552d9ed38399455a5e4472c147e421cb43d72a0db26d2943b55bdb307.svg",
      alt: "Illustration showing an online storefront with a 'share' icon in top right corner",
    },
    complete: false,
    primaryButton: {
      content: "Copy store link",
      props: {
        onAction: () => console.log("copied store link!"),
      },
    },
  },
  {
    id: 2,
    title: "Translate your store",
    description:
      "Translating your store improves cross-border conversion by an average of 13%. Add languages for your top customer regions for localized browsing, notifications, and checkout.",
    image: {
      url: "https://cdn.shopify.com/b/shopify-guidance-dashboard-public/nqjyaxwdnkg722ml73r6dmci3cpn.svgz",
    },
    complete: false,
    primaryButton: {
      content: "Add a language",
      props: {
        url: "https://www.example.com",
        external: true,
      },
    },
  },
];
