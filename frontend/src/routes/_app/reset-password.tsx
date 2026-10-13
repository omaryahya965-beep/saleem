import { createFileRoute } from "@tanstack/react-router";
import { ResetPasswordPage } from "@/features/auth/AuthPages";

export const Route = createFileRoute("/_app/reset-password")({ component: ResetPasswordPage });
