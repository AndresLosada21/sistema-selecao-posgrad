import { ResetPasswordForm } from "@/modules/auth/components/reset-password-form";

type ResetPasswordPageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token.slice(0, 4096) : "";
  return <ResetPasswordForm initialToken={token} />;
}
