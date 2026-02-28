require("dotenv").config();

const { createServer } = require("node:http");
const { createSchema, createYoga } = require("graphql-yoga");
const { typeDefs } = require("./schema");
const { resolvers } = require("./resolvers");
const { createSupabaseClient, createSupabasePublicClient } = require("./lib/supabase");

const port = Number(process.env.PORT || 4000);

const yoga = createYoga({
  schema: createSchema({
    typeDefs,
    resolvers
  }),
  graphiql: process.env.NODE_ENV !== "production",
  context: ({ request }) => {
    const authHeader = request.headers.get("authorization");

    return {
      supabase: createSupabaseClient(authHeader),
      supabasePublic: createSupabasePublicClient(authHeader),
      authHeader
    };
  }
});

const server = createServer(yoga);

server.listen(port, () => {
  console.log(`GraphQL server ready at http://localhost:${port}${yoga.graphqlEndpoint}`);
});
