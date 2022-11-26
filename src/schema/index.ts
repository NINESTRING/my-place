import { buildSchemaSync, Resolver, Query } from "type-graphql";
import { ImageResolver } from "./image";
import { PlaceResolver } from "./place";
import { authChecker } from "./auth";

@Resolver()
class DummyResolver {
  @Query(() => String)
  hello() {
    return "Nice to meet you";
  }
}

export const schema = buildSchemaSync({
  resolvers: [DummyResolver, ImageResolver, PlaceResolver],
  emitSchemaFile: process.env.NODE_ENV === "development",
  authChecker,
});
