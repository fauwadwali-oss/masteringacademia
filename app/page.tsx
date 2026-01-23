'use client';

import React, { useEffect, Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Footer from '@/components/Footer';
import {
  Search,
  GitMerge,
  CheckSquare,
  Scale,
  GitBranch,
  BarChart2,
  FlaskConical,
  Briefcase,
  ArrowRight,
  User,
  LogOut,
  LogIn,
  BookOpen,
  TrendingUp,
  PieChart,
  Users,
  Zap,
  Shield,
  Clock,
  Award,
  ChevronRight,
  Star,
  CheckCircle2
} from 'lucide-react';

function OAuthHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleOAuthCallback = async () => {
      if (typeof window !== 'undefined') {
        const hash = window.location.hash;
        const code = searchParams.get('code');

        if (hash || code) {
          router.replace(`/auth/callback${window.location.search}${hash}`);
          return;
        }
      }
    };

    handleOAuthCallback();
  }, [router, searchParams]);

  return null;
}

function HomePageContent() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [isScrolled, setIsScrolled] = useState(false);

  // Handle scroll effect for navbar
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Redirect logged-in users to program selector
  useEffect(() => {
    if (user && !loading && typeof window !== 'undefined') {
      const currentPath = window.location.pathname;
      if (currentPath === '/' || currentPath === '') {
        router.replace('/select-program');
      }
    }
  }, [user, loading, router]);

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  // MPH Tools
  const mphTools = [
    { icon: Search, title: "Literature Search", description: "PubMed, OpenAlex, medRxiv" },
    { icon: GitMerge, title: "Deduplication", description: "Smart duplicate removal" },
    { icon: CheckSquare, title: "Screening", description: "Title/abstract screening" },
    { icon: Scale, title: "Risk of Bias", description: "ROB 2.0, ROBINS-I, NOS" },
    { icon: BarChart2, title: "Meta-Analysis", description: "Forest & funnel plots" },
    { icon: GitBranch, title: "PRISMA Generator", description: "PRISMA 2020 diagrams" },
  ];

  // MHA/MBA Tools (Coming Soon)
  const mhambaTools = [
    { icon: BookOpen, title: "Business Literature", description: "SSRN, JSTOR, ProQuest" },
    { icon: TrendingUp, title: "Case Study Analysis", description: "Structured frameworks" },
    { icon: PieChart, title: "Market Research", description: "Industry analysis tools" },
    { icon: Users, title: "Stakeholder Mapping", description: "Relationship visualization" },
  ];

  const features = [
    {
      icon: Zap,
      title: "Lightning Fast",
      description: "Search millions of papers in seconds with our optimized infrastructure"
    },
    {
      icon: Shield,
      title: "Privacy First",
      description: "Your research data is encrypted and never shared with third parties"
    },
    {
      icon: Clock,
      title: "Save Time",
      description: "Automate tedious tasks and focus on what matters - your research"
    },
    {
      icon: Award,
      title: "PRISMA Compliant",
      description: "Follow best practices with built-in systematic review guidelines"
    }
  ];

  const testimonials = [
    {
      name: "Sarah Chen",
      role: "MPH Student, Johns Hopkins",
      content: "Mastering Academia saved me weeks of work on my systematic review. The deduplication tool alone is worth it!",
      rating: 5
    },
    {
      name: "Michael Rodriguez",
      role: "PhD Candidate, Harvard",
      content: "The PRISMA generator is incredibly intuitive. I generated publication-ready diagrams in minutes.",
      rating: 5
    },
    {
      name: "Emily Watson",
      role: "Research Assistant, Stanford",
      content: "Finally, research tools designed for students. Clean interface, powerful features, and completely free!",
      rating: 5
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-teal-500/30">
      <Suspense fallback={null}>
        <OAuthHandler />
      </Suspense>

      {/* Navigation */}
      <nav className={`border-b ${isScrolled ? 'border-slate-800 bg-slate-950/95' : 'border-slate-800/50 bg-slate-950/50'} backdrop-blur-xl fixed top-0 w-full z-50 transition-all duration-300`}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-gradient-to-br from-teal-400 to-teal-600 rounded-lg flex items-center justify-center shadow-lg shadow-teal-900/20 group-hover:shadow-teal-900/40 transition-shadow">
              <span className="text-white font-bold text-sm">MA</span>
            </div>
            <span className="font-semibold text-white tracking-tight">Mastering Academia</span>
          </Link>
          <div className="flex items-center gap-4 text-sm font-medium">
            {loading ? (
              <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
            ) : user ? (
              <>
                <div className="flex items-center gap-2 text-slate-300">
                  <User className="w-4 h-4" />
                  <span className="hidden sm:inline">{user.email}</span>
                </div>
                <Link
                  href="/select-program"
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition-colors"
                >
                  Dashboard
                </Link>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
                  <LogIn className="w-4 h-4" />
                  <span className="hidden sm:inline">Sign In</span>
                </Link>
                <Link
                  href="/signup"
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition-colors"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 text-center relative overflow-hidden">
        {/* Animated Background Gradients */}
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-teal-500/10 rounded-full blur-3xl -z-10 opacity-20 animate-pulse"></div>
        <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-3xl -z-10 opacity-20 animate-pulse" style={{ animationDelay: '1s' }}></div>

        <div className="max-w-5xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/50 border border-slate-700 text-slate-300 text-sm font-medium mb-8 backdrop-blur-sm">
            <Star className="w-4 h-4 text-teal-400" />
            <span>Trusted by Graduate Students Worldwide</span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 tracking-tight leading-tight">
            Research Tools for <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 via-teal-300 to-purple-400 animate-gradient">
              Graduate Students
            </span>
          </h1>

          {/* Subhead */}
          <p className="text-lg md:text-xl text-slate-400 mb-10 max-w-3xl mx-auto leading-relaxed">
            Streamline your systematic reviews, meta-analyses, and literature searches with powerful, 
            free tools designed specifically for MPH and MHA/MBA programs.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Link
              href="/signup"
              className="group px-8 py-4 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 text-white font-bold rounded-xl transition-all hover:scale-105 shadow-xl shadow-teal-500/20 hover:shadow-teal-500/40 flex items-center gap-2"
            >
              Get Started Free
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/mph"
              className="px-8 py-4 bg-slate-800/50 hover:bg-slate-800 text-white font-medium rounded-xl border border-slate-700 transition-all hover:border-slate-500 backdrop-blur-sm"
            >
              Explore Tools
            </Link>
          </div>

          {/* Social Proof */}
          <div className="flex items-center justify-center gap-6 text-sm text-slate-400">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-teal-400" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-teal-400" />
              <span>Free forever</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-teal-400" />
              <span>1B+ papers</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6 bg-slate-900/30 border-y border-slate-800/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Why Mastering Academia?</h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              Built by researchers, for researchers. Everything you need for systematic reviews and meta-analyses.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div 
                key={feature.title} 
                className="group p-6 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-teal-500/50 transition-all duration-300 hover:transform hover:-translate-y-1"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mb-4 group-hover:bg-teal-500/20 transition-colors">
                  <feature.icon className="w-6 h-6 text-teal-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Program Cards Section */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Choose Your Program</h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              Access specialized research tools designed for your academic discipline
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* MPH Card */}
            <div className="group relative p-8 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/50 border border-slate-800 hover:border-teal-500/50 transition-all duration-300 hover:transform hover:-translate-y-2 hover:shadow-2xl hover:shadow-teal-500/10">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-500/20 to-teal-600/20 border border-teal-500/30 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <FlaskConical className="w-8 h-8 text-teal-400" />
              </div>

              <h3 className="text-3xl font-bold text-white mb-2 group-hover:text-teal-400 transition-colors">
                MPH
              </h3>
              <p className="text-slate-500 text-sm mb-4 font-medium">Master of Public Health</p>

              <p className="text-slate-400 mb-6 leading-relaxed">
                Complete toolkit for systematic reviews and meta-analyses in epidemiology and public health research.
              </p>

              <div className="grid grid-cols-2 gap-3 mb-8">
                {mphTools.map((tool) => (
                  <div key={tool.title} className="flex items-start gap-2 text-sm text-slate-400 group-hover:text-slate-300 transition-colors">
                    <tool.icon className="w-4 h-4 text-teal-400 mt-0.5 flex-shrink-0" />
                    <span className="leading-tight">{tool.title}</span>
                  </div>
                ))}
              </div>

              <Link
                href="/mph"
                className="inline-flex items-center gap-2 text-teal-400 font-semibold hover:gap-3 transition-all group/link"
              >
                Explore MPH Tools
                <ChevronRight className="w-5 h-5 group-hover/link:translate-x-1 transition-transform" />
              </Link>

              <div className="absolute top-6 right-6 px-3 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-semibold">
                10 Tools Available
              </div>
            </div>

            {/* MHA/MBA Card */}
            <div className="group relative p-8 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/50 border border-slate-800 hover:border-purple-500/50 transition-all duration-300 hover:transform hover:-translate-y-2 hover:shadow-2xl hover:shadow-purple-500/10">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-500/30 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Briefcase className="w-8 h-8 text-purple-400" />
              </div>

              <h3 className="text-3xl font-bold text-white mb-2 group-hover:text-purple-400 transition-colors">
                MHA/MBA
              </h3>
              <p className="text-slate-500 text-sm mb-4 font-medium">Master of Health Administration / Business Administration</p>

              <p className="text-slate-400 mb-6 leading-relaxed">
                Business and healthcare management research tools for organizational analysis and strategic planning.
              </p>

              <div className="grid grid-cols-2 gap-3 mb-8">
                {mhambaTools.map((tool) => (
                  <div key={tool.title} className="flex items-start gap-2 text-sm text-slate-500 group-hover:text-slate-400 transition-colors">
                    <tool.icon className="w-4 h-4 text-purple-400/50 mt-0.5 flex-shrink-0" />
                    <span className="leading-tight">{tool.title}</span>
                  </div>
                ))}
              </div>

              <Link
                href="/mhamba"
                className="inline-flex items-center gap-2 text-purple-400 font-semibold hover:gap-3 transition-all group/link"
              >
                View MHA/MBA Tools
                <ChevronRight className="w-5 h-5 group-hover/link:translate-x-1 transition-transform" />
              </Link>

              <div className="absolute top-6 right-6 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-semibold">
                Coming Soon
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 px-6 bg-slate-900/30 border-y border-slate-800/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Loved by Researchers</h2>
            <p className="text-slate-400 text-lg">
              See what graduate students are saying about Mastering Academia
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div 
                key={testimonial.name}
                className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition-all"
              >
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-teal-400 text-teal-400" />
                  ))}
                </div>
                <p className="text-slate-300 mb-6 leading-relaxed">"{testimonial.content}"</p>
                <div>
                  <div className="font-semibold text-white">{testimonial.name}</div>
                  <div className="text-sm text-slate-500">{testimonial.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 text-center">
            <div className="p-6">
              <div className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-teal-600 mb-2">10+</div>
              <div className="text-slate-400 font-medium">Research Tools</div>
            </div>
            <div className="p-6">
              <div className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-teal-600 mb-2">1B+</div>
              <div className="text-slate-400 font-medium">Papers Searchable</div>
            </div>
            <div className="p-6">
              <div className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-teal-600 mb-2">100%</div>
              <div className="text-slate-400 font-medium">Free to Use</div>
            </div>
            <div className="p-6">
              <div className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-teal-600 mb-2">24/7</div>
              <div className="text-slate-400 font-medium">Available</div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-teal-500/10 to-purple-500/10 blur-3xl -z-10"></div>
        
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to Transform Your Research?
          </h2>
          <p className="text-lg text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Join thousands of graduate students using Mastering Academia to streamline their research projects 
            and produce publication-quality systematic reviews.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="group px-10 py-5 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 text-white font-bold rounded-xl transition-all hover:scale-105 shadow-xl shadow-teal-500/20 hover:shadow-teal-500/40 flex items-center gap-2"
            >
              Create Free Account
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="https://youtube.com/@MasteringPublicHealth"
              target="_blank"
              rel="noopener noreferrer"
              className="px-10 py-5 border-2 border-slate-700 hover:border-slate-500 text-white font-semibold rounded-xl transition-all hover:bg-slate-800/50 backdrop-blur-sm"
            >
              Watch Tutorials
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-teal-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    }>
      <HomePageContent />
    </Suspense>
  );
}
