import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <main className="auth-page">
      <SignUp
        appearance={{
          variables: {
            colorPrimary: "#8b82ff",
            colorBackground: "#ffffff",
            borderRadius: "0.75rem",
          },
        }}
        forceRedirectUrl="/chat"
        signInUrl="/sign-in"
      />
    </main>
  );
}
