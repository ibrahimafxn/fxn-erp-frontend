export interface Counter {
  _id?: string;
  name: string;               // ex: "user", "material"
  seq: number;
  prefix?: string;            // ex: "USR-"
}
