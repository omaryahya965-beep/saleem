import { createFileRoute } from "@tanstack/react-router";
import { ForgotPasswordPage } from "@/features/auth/AuthPages";

export const Route = createFileRoute("/_app/forgot-password")({ component: ForgotPasswordPage });
