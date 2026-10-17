# Progress tracking

Three files, one per owner, so nobody edits the same file and merge conflicts do not happen:

| File | Owner | Tasks |
|---|---|---|
| `server.md` | Saleamlak Setie (server) | S00 to S16 |
| `client-a.md` | Rufta Gaiem (Developer A) | A01 to A11 |
| `client-b.md` | Yared Teweldebirhan (Developer B) | B01 to B12 |

## Rules

1. **Each person edits only their own file.** The other two are read-only (they are used to check dependencies).
2. **Status is `todo` or `done`.** A task becomes `done` in the **last commit of its own branch** (set `Status: done` and fill `Done in` with the branch name and date). It is true as soon as the pull request is merged into `develop`.
3. **Git is the authority, not these files.** Read the files from `origin/develop` after `git pull`. Unmerged work shows up as remote branches and open pull requests. If a file and git disagree, tell the owner and fix the file in a small `docs/` pull request.
4. **If a pull request is closed without merging,** the task goes back to `todo` (or stays `todo`: the `done` commit was never merged).
5. **A task is available when every ID in `Depends on` is `done`** (look in all three files). `Server tasks needed` is not a blocker: the client uses MSW mocks until those server tasks are done, then removes the mocks.
6. **One task per branch, one branch per pull request.** The agent picks the branch name (`feature/<area>-<description>`, see CONTRIBUTING.md) and checks it does not already exist.
7. **New work that is not in the lists** (a bug fix, a change request) gets a new task added at the end of the owner's file with the next free ID and status `todo`, in a small `docs/` pull request.

## Dependency overview (static)

- Everything depends on **S00**.
- Server chain: S01 then S02, S03, S10; S03 then S04, S05, S06, S14; S05 then S07; S07 then S08; S04 and S07 then S09; S09 then S12; S07 and S08 then S13; S10, S05 and S08 then S11; S10 then S15; S16 last.
- Client A chain: A01, A02, then A03 (needs B01), A04, A05, A06; A07 then A08 (needs B02), A09, A10; A11 last.
- Client B chain: B01, B02; B01 then B03, B04, B10; B02 then B05, B07 (also B04), B08; B05 then B06; B08 then B09; B11 needs A02; B12 last.
- Cross-owner: A03 needs B01; A08 needs B02; B11 needs A02; B03 uses A04's exports.
