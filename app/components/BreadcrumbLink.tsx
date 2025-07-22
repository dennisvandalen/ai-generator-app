import { Link, useNavigate } from "@remix-run/react";
import { useAppBridge } from "@shopify/app-bridge-react";
import type { To } from "react-router";

export default function BreadcrumbLink({ to, children }: { to: To, children: React.ReactNode }) {
    const shopify = useAppBridge();
    const navigate = useNavigate();

    const handleClick = async (e: React.MouseEvent) => {
        e.preventDefault();

        await shopify.saveBar?.leaveConfirmation();

        navigate(to);
    };

    return (
        <Link to={to} onClick={handleClick} variant="breadcrumb">
            {children}
        </Link>
    );
}
