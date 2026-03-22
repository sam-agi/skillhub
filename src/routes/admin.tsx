import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin")({
  beforeLoad: ({ params }) => {
    const skill = params["*"] || undefined;
    throw redirect({
      to: "/management",
      search: skill ? { skill } : { skill: undefined },
      replace: true,
    });
  },
});
