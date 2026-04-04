import { AuthForm } from "@/modules/auth/components/auth-form";

type RegisterPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams;
  const nextPath = typeof params.next === "string" ? params.next : undefined;

  return <AuthForm mode="cadastro" nextPath={nextPath} />;
}
