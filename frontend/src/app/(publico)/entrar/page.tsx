import { AuthForm } from "@/modules/auth/components/auth-form";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = typeof params.next === "string" ? params.next : undefined;

  return <AuthForm mode="login" nextPath={nextPath} />;
}
