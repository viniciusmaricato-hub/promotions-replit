import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-6 h-16 border-b flex items-center justify-between bg-card">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold">
            PM
          </div>
          <span className="font-semibold text-lg tracking-tight">PromoMonitor</span>
        </div>
        <div className="flex gap-4">
          <Link href="/sign-in">
            <Button variant="ghost">Sign in</Button>
          </Link>
          <Link href="/sign-up">
            <Button>Get Started</Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-2xl text-center space-y-8">
          <h1 className="text-5xl font-extrabold tracking-tight text-foreground">
            Precision Intelligence for Sharp Marketing Teams
          </h1>
          <p className="text-xl text-muted-foreground leading-relaxed">
            Monitor competitor promotions across social media in real-time. 
            Identify high-value offers and no-deposit bonuses instantly.
          </p>
          <div className="pt-8">
            <Link href="/sign-up">
              <Button size="lg" className="h-12 px-8 text-base">
                Access Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}