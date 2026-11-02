import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicShell } from "@/components/public-shell";
import { useI18n } from "@/lib/i18n";

// Local translations dictionary for this portal page
const localTranslations = {
  en: {
    badge: "Portal Entrance",
    title: "Management & Catalog",
    subtitle:
      "Select a destination below to access the administration controls or explore the full collection catalog.",
    adminBtn: "Admin Panel",
    catalogBtn: "View Catalog",
  },
  ru: {
    badge: "Вход в систему",
    title: "Управление и Каталог",
    subtitle:
      "Выберите нужный раздел для перехода в панель администратора или просмотра полного каталога коллекций.",
    adminBtn: "Панель админа",
    catalogBtn: "Смотреть каталог",
  },
} as const;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: "Portal Access",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const { lang } = useI18n();

  // Safely fallback to English if current language key isn't 'ru'
  const t = localTranslations[lang === "ru" ? "ru" : "en"];

  return (
    <PublicShell>
      {/* Hero Section with Green-Optimized Background */}
      <section className="relative flex min-h-[85vh] w-full items-center justify-center overflow-hidden rounded-3xl bg-neutral-900 text-white shadow-2xl">
        {/* Background Image */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-1000 hover:scale-105"
          style={{
            backgroundImage: `url('/ThankYouMountain.webp')`,
          }}
        />

        {/* Gradient & Dark Overlays for High Contrast */}
        <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />

        {/* Hero Content */}
        <div className="relative z-10 flex max-w-4xl flex-col items-center px-6 py-20 text-center">
          {/* Status Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/60 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-300 backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            {t.badge}
          </div>

          {/* Main Heading */}
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl md:text-7xl lg:text-8xl text-balance drop-shadow-md">
            {t.title}
          </h1>

          {/* Subtitle */}
          <p className="mt-6 max-w-2xl text-base text-emerald-100/90 sm:text-lg md:text-xl font-normal leading-relaxed text-balance">
            {t.subtitle}
          </p>

          {/* Action Buttons */}
          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
            {/* Admin Portal Button */}
            <Link
              to="/admin"
              className="group relative inline-flex items-center justify-center overflow-hidden rounded-full bg-emerald-500 px-8 py-3.5 text-sm font-semibold uppercase tracking-widest text-emerald-950 shadow-lg shadow-emerald-950/40 transition-all duration-300 hover:bg-emerald-400 hover:shadow-emerald-500/25 hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>{t.adminBtn}</span>
              <svg
                className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14 5l7 7m0 0l-7 7m7-7H3"
                />
              </svg>
            </Link>

            {/* Catalog Button */}
            <Link
              to="/collections"
              className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-8 py-3.5 text-sm font-semibold uppercase tracking-widest text-white backdrop-blur-md transition-all duration-300 hover:border-white/40 hover:bg-white/20 hover:scale-[1.02] active:scale-[0.98]"
            >
              {t.catalogBtn}
            </Link>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}