import "next-auth";

declare module "next-auth" {
  interface User {
    role?: string;
    organizationId?: string;
    organizationName?: string;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      organizationId: string;
      organizationName: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
    organizationId?: string;
    organizationName?: string;
  }
}
