import "reflect-metadata";
import { NextApiRequest } from "next";
import { ApolloServer } from "apollo-server-micro";
import { schema } from "src/schema";
import { Context } from "src/schema/context";
import { prisma } from "src/prisma";
import Cors from "micro-cors";
// import { loadIdToken } from "src/auth/firebaseAdmin";

const cors = Cors();
const apolloServer = new ApolloServer({
  schema,
  context: async ({ req }: { req: NextApiRequest }): Promise<Context> => {
    // const uid = await loadIdToken(req);
    const uid = "1";

    return {
      uid,
      prisma,
    };
  },
  //   tracing: process.env.NODE_ENV === "development",
});

const startServer = apolloServer.start();
// const handler =

export default cors(async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.end();
    return false;
  }

  await startServer;

  await apolloServer.createHandler({ path: "/api/graphql" })(req, res);
});

export const config = {
  api: {
    bodyParser: false,
  },
};
