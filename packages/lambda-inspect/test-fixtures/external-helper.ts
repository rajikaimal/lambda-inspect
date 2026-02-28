export function externalHelper() {
  const dynamo = new DynamoDB();
  return dynamo;
}
