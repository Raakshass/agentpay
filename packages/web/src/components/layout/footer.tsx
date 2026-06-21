import Link from "next/link";
import { Github, BookOpen, Package } from "lucide-react";

const footerLinks = {
  product: [
    { label: "Catalog", href: "/catalog" },
    { label: "Providers", href: "/providers" },
    { label: "Live Demo", href: "/demo" },
  ],
  resources: [
    { label: "Documentation", href: "/docs" },
    { label: "SDK on npm", href: "https://www.npmjs.com/package/@conduit/sdk", external: true },
    { label: "GitHub", href: "https://github.com/agentpay", external: true },
  ],
};

const socialLinks = [
  { label: "GitHub", href: "https://github.com/agentpay", icon: Github },
  { label: "Docs", href: "/docs", icon: BookOpen },
  { label: "npm", href: "https://www.npmjs.com/package/@conduit/sdk", icon: Package },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-bg" role="contentinfo">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-12">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center gap-2 text-text-primary font-semibold text-lg">
              <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center">
                <span className="text-black text-xs font-bold">AP</span>
              </div>
              Conduit
            </Link>
            <p className="mt-4 text-text-muted text-sm leading-relaxed max-w-md">
              The permissionless payment layer for autonomous AI agents.
              State channel micropayments on Solana — no subscriptions, no credit cards.
            </p>
            <div className="mt-6 flex items-center gap-4">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-text-muted hover:text-text-primary hover:border-border-hover transition-colors duration-200"
                  aria-label={social.label}
                >
                  <social.icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Product links */}
          <div>
            <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-4">
              Product
            </h3>
            <ul className="space-y-3">
              {footerLinks.product.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-text-muted hover:text-text-primary transition-colors duration-200"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resource links */}
          <div>
            <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-4">
              Resources
            </h3>
            <ul className="space-y-3">
              {footerLinks.resources.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-text-muted hover:text-text-primary transition-colors duration-200"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-text-dim">
            © {new Date().getFullYear()} Conduit. Built on Solana.
          </p>
          <p className="text-xs text-text-dim">
            Devnet by default · Mainnet via env var
          </p>
        </div>
      </div>
    </footer>
  );
}
