name "git"
description "the stupid content tracker"
version "0.1.0"

option version: boolean { #
  description "show the git version"
}

option help: boolean {
  short "h"
  description "show help"
}

command clone {
  argument repository: string

  argument directory: string? {
    description "directory to clone into"
  }

  option branch: string {
    short "b"
    description "checkout a specific branch"
  }
}

command add {
  description "add file contents to the index"

  argument paths: string[] {
    description "files to stage"
  }

  option all: boolean {
    short "A"
    description "Stage all changes"
  }
}

command remote {
  description "manage remote repositories"

  command add {
    argument name: string
    argument url: string
  }

  command remove {
    argument name: string
  }
}
