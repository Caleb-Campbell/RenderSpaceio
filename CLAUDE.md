# RenderSpace Development Guidelines

## Commands
- `pnpm dev` - Run development server with Turbopack
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm db:setup` - Set up database
- `pnpm db:seed` - Seed database with sample data
- `pnpm db:generate` - Generate Drizzle migrations
- `pnpm db:migrate` - Run database migrations
- `pnpm db:studio` - Launch Drizzle Studio UI

## Code Style
- **Imports**: Use path aliases (@/lib/, @/components/); group external first
- **Formatting**: 2-space indent, semicolons, double quotes in components
- **Types**: Use TypeScript with strict mode; interface for props; Zod validation
- **Components**: 'use client' directive when needed; PascalCase naming
- **Functions/Variables**: camelCase; descriptive naming
- **Error Handling**: Try/catch for external calls; consistent error structures
- **Styling**: Tailwind CSS with shadcn/ui "new-york" style; use cn utility
- **State**: React context for global state; Server actions for mutations
- **Architecture**: Next.js App Router; Drizzle ORM; Stripe for payments
