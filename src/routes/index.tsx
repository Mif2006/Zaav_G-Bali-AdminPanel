import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicShell } from "@/components/public-shell";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ювелирные украшения ручной работы" },
      {
        name: "description",
        content: "Авторские украшения — кольца, серьги, браслеты, подвески и цепи.",
      },
      { property: "og:title", content: "Ювелирные украшения ручной работы" },
      {
        property: "og:description",
        content: "Авторские украшения — кольца, серьги, браслеты, подвески и цепи.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const { t } = useI18n();
  return (
    <PublicShell>
      {/* Landing placeholder — drop your prepared sections into this file later.
          Each section below is a self-contained block, easy to swap out. */}

      <section className="flex min-h-[70vh] flex-col items-center justify-center text-center">
        <h1 className="text-5xl font-semibold tracking-tight md:text-7xl">
          {t("app.title")}
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          {t("landing.soon")}
        </p>
        <Link
          to="/collections"
          className="mt-10 inline-flex items-center justify-center rounded-full bg-foreground px-8 py-3 text-sm font-medium uppercase tracking-widest text-background transition hover:opacity-90"
        >
          {t("nav.catalog")}
        </Link>
      </section>

      {/* Add more <section /> blocks here as you build out the landing. */}
    </PublicShell>
  );
}
