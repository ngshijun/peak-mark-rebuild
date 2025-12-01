- Always use context7 when I need code generation, setup or configuration steps, or
library/API documentation. This means you should automatically use the Context7 MCP
tools to resolve library id and get library docs without me having to explicitly ask.
- Use database.types.ts as the single source of truth for database schemas. Never modify this file manually.
- Use relevant mcp whenever you think it's required. Don't need to ask for my permission.
- Never recommend me a quick fix. Give me recommendations that follow industrial best practices.
- Always create a supabase migration file using `npx supabase migration new <migration-name>`, 
and commit it using `npx supabase db push`. 
Finally, regenerate the database types using `npx supabase gen types typescript --linked > src/types/database.types.ts`.