import { ResetPasswordForm } from "@/modules/auth/components/reset-password-form";

type ResetPasswordPageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const params = await searchParams;
  return <ResetPasswordForm initialToken={typeof params.token === "string" ? params.token : ""} />;
}
