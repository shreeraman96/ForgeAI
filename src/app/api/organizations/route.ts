import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { z } from "zod";

const signupSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  organizationName: z.string().min(1).optional(),
  inviteToken: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = signupSchema.parse(body);

    // Check if email already exists
    const existing = await prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existing) {
      return NextResponse.json({ error: "Email already in use" }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    // Invite-based signup
    if (data.inviteToken) {
      const invite = await prisma.invite.findUnique({
        where: { token: data.inviteToken },
      });

      if (!invite || invite.accepted || invite.expiresAt < new Date()) {
        return NextResponse.json(
          { error: "Invalid or expired invitation" },
          { status: 400 }
        );
      }

      const user = await prisma.user.create({
        data: {
          name: data.name,
          email: data.email,
          passwordHash,
          role: invite.role,
          organizationId: invite.organizationId,
        },
      });

      await prisma.invite.update({
        where: { id: invite.id },
        data: { accepted: true },
      });

      return NextResponse.json({ userId: user.id }, { status: 201 });
    }

    // New organization signup
    if (!data.organizationName) {
      return NextResponse.json(
        { error: "Organization name is required" },
        { status: 400 }
      );
    }

    const slug = data.organizationName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // Ensure unique slug
    const existingOrg = await prisma.organization.findUnique({
      where: { slug },
    });

    const finalSlug = existingOrg
      ? `${slug}-${Date.now().toString(36)}`
      : slug;

    const org = await prisma.organization.create({
      data: {
        name: data.organizationName,
        slug: finalSlug,
        users: {
          create: {
            name: data.name,
            email: data.email,
            passwordHash,
            role: "ADMIN",
          },
        },
      },
    });

    return NextResponse.json({ organizationId: org.id }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
