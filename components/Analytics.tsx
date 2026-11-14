import Script from "next/script";

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;

/**
 * Google Tag Manager, and nothing without a container id.
 *
 * Gated on the env var rather than hard-coded, for one practical reason
 * and one that matters more. Practically, a container that loads in
 * `npm run dev` fills the real property with a developer reloading the
 * map two hundred times, which is the fastest way to make the numbers
 * useless. And it means a fork, a preview deploy or a local checkout is
 * not quietly reporting somebody else's traffic to an account they do
 * not own.
 *
 * `afterInteractive` rather than `beforeInteractive`: the map is the
 * page, and the first paint is the one thing this product cannot afford
 * to delay by a third-party script. Analytics that cost a second of
 * time-to-map would be measuring the damage they caused.
 *
 * The snippet is the official one, not the gtag shorthand. The version
 * that circulates — an async `gtm.js` tag plus a `gtag()` bootstrap —
 * loads the container but never pushes `gtm.start`, which is the event
 * GTM's own Page View trigger and all its timing measurements key off.
 * It appears to work and silently under-reports.
 */
export default function Analytics() {
  if (!GTM_ID) return null;
  return (
    <Script id="gtm" strategy="afterInteractive">
      {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`}
    </Script>
  );
}

/**
 * The no-JavaScript fallback, which belongs immediately inside <body>.
 *
 * Separate from the script above because it has to render in a different
 * place in the document, and `next/script` will not put it there.
 */
export function AnalyticsNoScript() {
  if (!GTM_ID) return null;
  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
        height="0"
        width="0"
        style={{ display: "none", visibility: "hidden" }}
        title="Google Tag Manager"
      />
    </noscript>
  );
}
