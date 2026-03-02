import { Link } from "wouter";

export function Navbar() {
  return (
    <nav className="border-b border-b1 bg-background/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/">
            <a className="flex items-center gap-2" data-testid="link-home">
              <span className="font-heading text-2xl text-white tracking-wider">RAW</span>
              <span className="font-heading text-2xl text-gold tracking-wider">FUNDED</span>
            </a>
          </Link>
          
          <div className="hidden md:flex items-center gap-6">
            <Link href="/leaderboard">
              <a className="text-sm font-medium text-muted-foreground hover:text-white transition-colors" data-testid="link-leaderboard">Leaderboard</a>
            </Link>
            <a href="#" className="text-sm font-medium text-muted-foreground hover:text-white transition-colors" data-testid="link-faq">FAQ</a>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Link href="/login">
            <a className="text-sm font-medium text-white hover:text-gold transition-colors" data-testid="link-login">
              Login →
            </a>
          </Link>
          <Link href="/apply">
            <a className="bg-gold text-black font-heading font-bold px-6 py-2 rounded-sm text-sm hover:bg-white transition-colors" data-testid="link-apply-nav">
              APPLY NOW
            </a>
          </Link>
        </div>
      </div>
    </nav>
  );
}