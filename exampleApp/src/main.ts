import * as prompt from "simple-cli-prompter";
import * as tmp from "tmp";
import * as cp from "child_process";
import open from "open";
import * as path from "path";
import * as fs from "fs";

const popularRepos = [
  "jquery/jquery",
  "sindresorhus/awesome",
  "nodejs/node",
  "microsoft/TypeScript",
  "facebook/react",
  "vuejs/vue",
  "angular/angular.js",
  "emberjs/ember.js",
  "github/codeql",
];

void (async function main() {
  async function selectRepo(): Promise<[string, string]> {
    const usePossibleRepos = await prompt.confirm(
      "Select among some popular repositories?",
    );
    const repo = await prompt.ask(
      "Choose a repository",
      usePossibleRepos ? popularRepos : undefined,
    );
    // either "http://github.com/org/repo.git" or "org/repo"
    const reg = /(?:https?:\/\/)?(?:github.com\/)?([^/]+)\/([^/]+)(?:\.git)?/;
    const match = repo.match(reg);
    if (!match) {
      console.log("Invalid repository");
      return selectRepo();
    }
    return [match[1], match[2]];
  }

  const [org, repo] = await selectRepo();

  console.log(`You chose ${org}/${repo}`);

  const tmpDir = tmp.dirSync({ unsafeCleanup: true });

  // start async, but don't wait for it
  const clonePromise = waitForProcess(
    "git clone " + org + "/" + repo,
    cp.spawn("git", ["clone", `https://github.com/${org}/${repo}.git/`, "."], {
      cwd: tmpDir.name,
      stdio: "ignore",
    }),
  );

  await (async function doSomething(): Promise<void> {
    const answer = await prompt.ask("What do you want to do?", [
      "Checkout a commit",
      "View a file",
      "Quit",
    ]);

    if (answer === "Quit") {
      tmpDir.removeCallback();
      process.exit(0);
    }

    if (answer === "Checkout a commit") {
      await clonePromise; // now we need to wait for the clone to finish

      const commitsTmpFile = tmp.fileSync({ postfix: ".txt" });

      // get all commits
      cp.execSync(
        'git log --oneline --format="%H %s" > ' + commitsTmpFile.name,
        {
          cwd: tmpDir.name,
          encoding: "utf8",
        },
      );

      const commits = fs
        .readFileSync(commitsTmpFile.name, "utf8")
        .split("\n")
        .filter((c) => c);

      const commit = await prompt.ask(
        "Choose a commit",
        commits.map((c) => {
          const hash = c.slice(0, c.indexOf(" "));
          const msg = c.slice(c.indexOf(" ") + 1);
          return {
            message: msg,
            name: hash,
            hint: hash,
          };
        }),
      );

      cp.execFileSync("git", ["checkout", commit], {
        cwd: tmpDir.name,
        stdio: "ignore",
      });
      return await doSomething();
    }

    if (answer === "View a file") {
      await clonePromise; // now we need to wait for the clone to finish
      const file = await prompt.file("Select a file", undefined, tmpDir.name);

      console.log("Selected file: " + file);
      const confirm = await prompt.confirm(
        "Are you sure you want to open the file?",
        true,
        30,
      );
      if (!confirm) {
        return await doSomething();
      }

      // open with text editor
      await open(path.join(tmpDir.name, file));
      return await doSomething();
    }
  })();
})();

// TODO: Move or something.
/**
 * Waits for the given process to terminate, and returns its stdout.
 * On crash or non-zero exit code, throws an error with the given message.
 */
export function waitForProcess(
  msg: string,
  proc: cp.ChildProcess,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let stderr = "";
    let stdout = "";
    proc.stdout?.on("data", (data) => {
      stdout += data;
    });
    proc.stderr?.on("data", (data) => {
      stderr += data;
    });
    proc.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(msg + " failed with code " + code + "\n" + stderr));
      }
    });
  });
}
