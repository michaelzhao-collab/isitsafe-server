/**
 * 类型声明：ali-oss 无官方 @types，避免 TS 编译报错。
 * 用 class 声明使 OSS 同时作为“类型”和“值”（构造函数）使用。
 */
declare module 'ali-oss' {
  class OSS {
    constructor(options?: {
      region?: string;
      bucket?: string;
      accessKeyId?: string;
      accessKeySecret?: string;
      [key: string]: any;
    });
    put(objectKey: string, file: Buffer | string, options?: any): Promise<any>;
    [key: string]: any;
  }
  export default OSS;
}
