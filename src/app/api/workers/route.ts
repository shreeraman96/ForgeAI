import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { inviteWorkerSchema } from "@/lib/validations";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workers = await prisma.user.findMany({
    where: { organizationId: session.user.organizationId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      _count: { select: { chatSessions: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const invites = await prisma.invite.findMany({
    where: {
      organizationId: session.user.organizationId,
      accepted: false,
    },
    select: {
      id: true,
      email: true,
      token: true,
      role: true,
      createdAt: true,
      expiresAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ workers, invites });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { email, role } = inviteWorkerSchema.parse(body);

    // Check if user already exists in org
    const existingUser = await prisma.user.findFirst({
      where: { email, organizationId: session.user.organizationId },
    });
    if (existingUser) {
      return NextResponse.json(
        { error: "User already belongs to this organization" },
        { status: 400 }
      );
    }

    // Check for existing pending invite
    const existingInvite = await prisma.invite.findFirst({
      where: {
        email,
        organizationId: session.user.organizationId,
        accepted: false,
      },
    });
    if (existingInvite) {
      return NextResponse.json(
        { error: "Invite already sent to this email" },
        { status: 400 }
      );
    }

    const invite = await prisma.invite.create({
      data: {
        email,
        role,
        organizationId: session.user.organizationId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // Derive base URL from the incoming request so invites always point at the
    // same origin the admin is using. Falls back to PUBLIC_APP_URL if set.
    const forwardedHost = request.headers.get("x-forwarded-host");
    const forwardedProto = request.headers.get("x-forwarded-proto");
    const host = forwardedHost ?? request.headers.get("host");
    const proto = forwardedProto ?? (host?.startsWith("localhost") ? "http" : "https");
    const baseUrl = process.env.PUBLIC_APP_URL ?? (host ? `${proto}://${host}` : new URL(request.url).origin);
    const inviteUrl = `${baseUrl}/signup?invite=${invite.token}`;

    return NextResponse.json({ invite, inviteUrl }, { status: 201 });
  } catch (error) {
    console.error("Invite error:", error);
    return NextResponse.json(
      { error: "Failed to create invite" },
      { status: 500 }
    );
  }
}
