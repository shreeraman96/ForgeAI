import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FileText, MessageSquare, Users, Zap } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="text-xl font-bold">ForgeAI</span>
          <div className="flex gap-2">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Sign in
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex items-center">
        <div className="max-w-6xl mx-auto px-4 py-20 text-center">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight max-w-3xl mx-auto">
            Your workforce&apos;s{" "}
            <span className="text-primary">AI brain</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
            Plug in what you know, help your workers do what they do, better.
            ForgeAI ingests your SOPs, manuals, and training docs — then
            delivers AI-powered answers to your frontline workers in real time.
          </p>
          <div className="mt-8 flex gap-3 justify-center">
            <Link href="/signup">
              <Button size="lg">Start Free Trial</Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline">
                Sign In
              </Button>
            </Link>
          </div>

          {/* Features */}
          <div className="mt-20 grid md:grid-cols-4 gap-8 text-left">
            {[
              {
                icon: FileText,
                title: "Drop in your docs",
                description:
                  "Upload PDFs, Word docs, and images. AI auto-indexes everything into a searchable knowledge base.",
              },
              {
                icon: MessageSquare,
                title: "Ask anything",
                description:
                  "Workers ask natural language questions and get accurate answers sourced from your own documentation.",
              },
              {
                icon: Users,
                title: "Built for teams",
                description:
                  "Role-based access. Supervisors manage docs, workers get the answers they need — on any device.",
              },
              {
                icon: Zap,
                title: "Setup in minutes",
                description:
                  "No manual digitization needed. Upload your binders, and ForgeAI does the rest.",
              },
            ].map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title}>
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-1">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-6">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-muted-foreground">
          ForgeAI — AI-Native Connected Worker Platform for SMBs
        </div>
      </footer>
    </div>
  );
}
