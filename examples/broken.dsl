name "git
description

command clone {
  argument repository string
  argument directory: path? {
    description "directory to clone into"
  @@ option branch: string {
    short "b"
  }
}

}

command add {
  argument paths: path[
