{
  inputs = {
    flake-utils.url = "github:numtide/flake-utils";
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    prisma-utils.url = "github:VanCoding/nix-prisma-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
      prisma-utils,
      ...
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs { inherit system; };
        prisma =
          (prisma-utils.lib.prisma-factory {
            inherit pkgs;
            # just copy these hashes for now, and then change them when nix complains about the mismatch
            prisma-fmt-hash = "sha256-0PSvJ2tB5pBS7k65qsF2MCV3s06orrDYDkaC5jnfbPU=";
            query-engine-hash = "sha256-G2iumxi4HMqcSdmYm+KAlj0k2haX9EE9bh7CScdX7lU=";
            libquery-engine-hash = "sha256-Uxs7CWqxgBhOivn495YkndEsrG55hHpYrNjdCeUrqwk=";
            schema-engine-hash = "sha256-08sTw6io+Cyx5O2Mnk/yflAcgzZYxMOPGGSM6OLzqRA=";
          }).fromYarnLock
            ./checkhen/yarn.lock;
      in
      {
        devShell = pkgs.mkShell {
          buildInputs = with pkgs; [
            nodejs_18
            yarn-berry
          ];

          shellHook = prisma.shellHook;
        };
      }
    );
}
