export function helperFunction() {
  const s3 = new S3();
  return s3;
}

export const main = async () => {
  helperFunction();
};
