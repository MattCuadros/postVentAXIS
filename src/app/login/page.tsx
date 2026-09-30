"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AxisBand } from "@/components/brand/axis-band";
import { AxisLogo } from "@/components/brand/axis-logo";
import { Tagline } from "@/components/brand/tagline";
import { Button, buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { signInWithPassword, type SignInResult } from "@/data/auth";
import { useSession } from "@/data/session-context";
import { useDataContext } from "@/data/store-context";
import { isTestMode } from "@/lib/app-mode";
import { ROLE_HOME } from "@/lib/role-home";
import { fieldErrors, loginSchema } from "@/lib/schemas";

type Failure = Extract<SignInResult, { ok: false }>["reason"];

function failureMessage(reason: Failure, testMode: boolean): string {
  switch (reason) {
    case "CREDENCIALES_INVALIDAS":
      // Genérico a propósito: nunca se dice cuál de los dos datos falló.
      return "Correo o contraseña incorrectos.";
    case "ERROR_RED":
      return "No pudimos conectarnos. Revisa tu conexión e inténtalo de nuevo.";
    case "NO_DISPONIBLE":
      return testMode
        ? "El ingreso con contraseña se habilitará cuando PostventAXIS pase a producción. Por ahora, entra a la pantalla de pruebas."
        : "El ingreso no está disponible en este momento. Intenta más tarde.";
  }
}

/** Entrada a la app: correo y contraseña. En modo pruebas, además, acceso a la pantalla de pruebas. */
export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useSession();
  const { state } = useDataContext();
  const testMode = isTestMode();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<Failure | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setFailure(null);

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});

    setSubmitting(true);
    try {
      const result = await signInWithPassword(parsed.data.email, parsed.data.password);
      if (result.ok) {
        const user = state.users.find((item) => item.id === result.userId);
        setUser(result.userId);
        router.replace(user ? ROLE_HOME[user.role] : "/");
      } else {
        setFailure(result.reason);
      }
    } catch {
      setFailure("ERROR_RED");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-full flex-1 flex-col bg-surface">
      <section className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 py-10 sm:justify-center">
        <div className="mb-10 flex flex-col items-center gap-6 text-center">
          <AxisLogo width={180} priority />
          <div>
            <h1 className="text-2xl font-bold text-accent">PostventAXIS</h1>
            <p className="mt-2 text-sm text-ink-secondary">Ingresa con tu correo y contraseña.</p>
          </div>
        </div>

        <Card className="border border-line-soft p-5 sm:p-6">
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <Input
              label="Correo"
              name="login-email"
              type="email"
              autoComplete="username"
              inputMode="email"
              value={email}
              error={errors.email}
              onChange={(event) => setEmail(event.target.value)}
            />

            <div className="flex w-full flex-col gap-1.5">
              <label className="text-sm font-bold text-ink" htmlFor="login-password">Contraseña</label>
              <div className="relative">
                <input
                  id="login-password"
                  name="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  aria-invalid={errors.password ? true : undefined}
                  aria-describedby={errors.password ? "login-password-error" : undefined}
                  onChange={(event) => setPassword(event.target.value)}
                  className={
                    "h-10 w-full rounded-md border bg-surface pl-3 pr-20 text-sm text-ink transition-colors placeholder:text-ink-muted focus:outline-none focus:ring-2 " +
                    (errors.password ? "border-danger focus:border-danger focus:ring-danger" : "border-line focus:border-accent focus:ring-accent")
                  }
                />
                <button
                  type="button"
                  aria-pressed={showPassword}
                  aria-controls="login-password"
                  className="absolute inset-y-0 right-0 rounded-r-md px-3 text-sm font-bold text-accent hover:underline focus:outline-none focus:ring-2 focus:ring-accent"
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? "Ocultar" : "Mostrar"}
                </button>
              </div>
              {errors.password && <p id="login-password-error" className="text-sm text-danger">{errors.password}</p>}
            </div>

            {failure && <Notice tone={failure === "NO_DISPONIBLE" ? "info" : "danger"}>{failureMessage(failure, testMode)}</Notice>}

            <Button type="submit" size="lg" fullWidth disabled={submitting}>
              {submitting ? "Ingresando…" : "Ingresar"}
            </Button>
          </form>

          {testMode && (
            <>
              <div className="my-5 flex items-center gap-3 text-sm text-ink-secondary" aria-hidden>
                <span className="h-px flex-1 bg-line-soft" />
                o
                <span className="h-px flex-1 bg-line-soft" />
              </div>
              <Link href="/pruebas" className={buttonClassName({ variant: "secondary", size: "lg", fullWidth: true })}>
                Entrar a la pantalla de pruebas
              </Link>
              <p className="mt-3 text-center text-xs text-ink-secondary">Solo durante la etapa de pruebas. Los datos se guardan en este navegador.</p>
            </>
          )}
        </Card>

        <Tagline className="mt-10" />
      </section>
      <AxisBand />
    </main>
  );
}
