import { CartProvider } from "components/cart/cart-context";
import { WishlistProvider } from "components/wishlist/wishlist-context";
import { AnnouncementBar } from "components/layout/announcement-bar";
import Footer from "components/layout/footer";
import { Navbar } from "components/layout/navbar";
import { MetaPixel } from "components/meta-pixel/meta-pixel";
import { getAllCategories } from "lib/storefront/categories";
import { getMenu } from "lib/storefront/content";
import { getStoreSettings, ScriptSnippet } from "lib/storefront/settings";
import Script from "next/script";
import { ReactNode } from "react";

export const dynamic = "force-dynamic";

function getRenderedCode(script: ScriptSnippet): string {
  if (script.type === "js") return `<script>${script.code}</script>`;
  if (script.type === "css") return `<style>${script.code}</style>`;
  return script.code;
}

function isRenderable(script: ScriptSnippet): boolean {
  const code = script.code?.trim();
  if (!code || code.length === 0) return false;
  if (
    code.includes("custom-head-scripts") ||
    code.includes("custom-body-start-scripts") ||
    code.includes("custom-body-end-scripts")
  )
    return false;
  if (code.includes('"id":"')) return false;
  return true;
}

function HeadScripts({ scripts }: { scripts: ScriptSnippet[] }) {
  const headScripts = scripts.filter(
    (s) => s.enabled && s.location === "head" && isRenderable(s),
  );
  return (
    <>
      {headScripts.map((s) => {
        if (s.type === "js") {
          return (
            <Script
              key={s.id}
              id={`script-${s.id}`}
              strategy="beforeInteractive"
              dangerouslySetInnerHTML={{ __html: s.code }}
            />
          );
        }
        if (s.type === "css") {
          return (
            <style
              key={s.id}
              id={`script-${s.id}`}
              dangerouslySetInnerHTML={{ __html: s.code }}
            />
          );
        }
        return (
          <div
            key={s.id}
            id={`script-${s.id}`}
            dangerouslySetInnerHTML={{ __html: s.code }}
            style={{ display: "contents" }}
          />
        );
      })}
    </>
  );
}

function BodyStartScripts({ scripts }: { scripts: ScriptSnippet[] }) {
  const bodyStart = scripts.filter(
    (s) => s.enabled && s.location === "body_start" && isRenderable(s),
  );
  return (
    <>
      {bodyStart.map((s) => (
        <div
          key={s.id}
          dangerouslySetInnerHTML={{ __html: getRenderedCode(s) }}
          style={{ display: "contents" }}
        />
      ))}
    </>
  );
}

function BodyEndScripts({ scripts }: { scripts: ScriptSnippet[] }) {
  const bodyEnd = scripts.filter(
    (s) => s.enabled && s.location === "body_end" && isRenderable(s),
  );
  return (
    <>
      {bodyEnd.map((s) => (
        <div
          key={s.id}
          dangerouslySetInnerHTML={{ __html: getRenderedCode(s) }}
          style={{ display: "contents" }}
        />
      ))}
    </>
  );
}

export default async function StorefrontLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [settings, menu, footerMenu, categories] = await Promise.all([
    getStoreSettings(),
    getMenu("next-js-frontend-header-menu"),
    getMenu("next-js-frontend-footer-menu"),
    getAllCategories(),
  ]);

  return (
    <>
      <BodyStartScripts scripts={settings.scripts} />

      <MetaPixel pixelId={settings.facebookPixelId} />

      <HeadScripts scripts={settings.scripts} />

      <WishlistProvider>
      <CartProvider>
        <div className="flex min-h-screen flex-col">
          {settings.announcementBar && settings.announcementText && (
            <AnnouncementBar
              text={settings.announcementText}
              link={settings.announcementLink || undefined}
              bgColor={settings.primaryColor}
            />
          )}
          <Navbar menu={menu} categories={categories} pages={footerMenu} settings={settings} />
                    <main className="flex-1 bg-neutral-50">
            {children}
          </main>
          <Footer />
        </div>
      </CartProvider>
      </WishlistProvider>

      <BodyEndScripts scripts={settings.scripts} />
    </>
  );
}

