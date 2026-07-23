import LoginForm from '@/components/LoginForm';

// Login — route "/" (FR-1). Split layout: hero image with branding (left) +
// login card (right). No "forgot password" link (FR-1.4 / FR-1.8). Server
// component shell; the interactive form is the client leaf.
export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col lg:flex-row">
      {/* Hero with branding */}
      <div className="relative min-h-[40vh] flex-1 lg:min-h-screen">
        {/* Self-hosted placeholder; decorative (branding is real text below). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/login-hero.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-black/10"
        />
        <div className="relative z-10 flex h-full items-center justify-center p-8 text-center text-white">
          <div className="max-w-xl">
            <h1 className="text-3xl font-bold uppercase tracking-wide sm:text-4xl lg:text-5xl">
              Griswold Hospitality
            </h1>
            <p className="mt-3 text-base font-light uppercase tracking-[0.3em] opacity-90 sm:text-lg">
              Client Portal
            </p>
          </div>
        </div>
      </div>

      {/* Login card */}
      <div className="flex w-full items-center justify-center bg-white p-6 sm:p-8 lg:max-w-md lg:p-12 xl:max-w-lg">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold text-foreground">Sign in</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Please enter your credentials to access your reports.
            </p>
          </div>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
