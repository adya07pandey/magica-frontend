import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return (
    <main className="auth-page">
      <SignIn
        appearance={{
          variables: {
            colorPrimary: "#8b82ff",
            colorBackground: "#ffffff",
            borderRadius: "0.75rem",
          },
        }}
        forceRedirectUrl="/chat"
        signUpUrl="/sign-up"
      />
    </main>
  );
}
