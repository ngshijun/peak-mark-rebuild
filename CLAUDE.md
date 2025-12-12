# Claude Code Instructions

## Tech Stack

- TypeScript
- Vue 3 (Composition API)
- TailwindCSS 4
- shadcn-vue
- Supabase

---

## MCP Tool Usage
### Context7 (REQUIRED for code tasks)
**Always use Context7 MCP tools** before generating code, configuration, or setup instructions.

Workflow:
1. Call `resolve-library-id` to find the correct library ID
2. Call `get-library-docs` with that ID to fetch current documentation
3. Generate code based on the retrieved docs

**Triggers** — Use Context7 when:
- Writing new components, composables, or utilities
- Setting up or configuring libraries/tools
- Referencing any library or API documentation
- Answering questions about library usage or best practices

### Other MCP Tools
Use any relevant MCP tools automatically when they would improve the response. No permission needed.

---

## Database Rules
### Single Source of Truth
`src/types/database.types.ts` is the **single source of truth** for all database schemas.
**NEVER** edit this file manually — it is auto-generated.

### Supabase Migration Workflow
When database changes are needed, follow this exact sequence:

```bash
# 1. Create migration file
npx supabase migration new <migration-name>
# 2. Edit the generated SQL file in supabase/migrations/
# 3. Apply migration to database
npx supabase db push
# 4. Regenerate TypeScript types
npx supabase gen types typescript --linked > src/types/database.types.ts
```

Afterwards, check for security and performace issues with supabase mcp and fix them if necessary.

---

## Code Quality Standards
### No Quick Fixes
Never suggest quick fixes, hacks, or workarounds. All recommendations must:

- Follow industry best practices
- Be production-ready
- Consider maintainability and scalability
- Use proper typing (no `any` unless absolutely necessary)

### Vue 3 Conventions
- Use `<script setup lang="ts">` syntax
- Prefer composables for reusable logic
- Use `defineProps` and `defineEmits` with TypeScript generics