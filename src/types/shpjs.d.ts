declare module "shpjs" {
  const shp: (input: ArrayBuffer | Uint8Array | Buffer) => Promise<unknown>;
  export default shp;
}
