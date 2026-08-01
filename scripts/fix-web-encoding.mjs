import {
  readdir,
  readFile,
  writeFile,
} from 'node:fs/promises';

import path from 'node:path';

const root = path.resolve(
  'apps/web/src',
);

const allowedExtensions =
  new Set([
    '.ts',
    '.tsx',
    '.css',
    '.json',
    '.md',
  ]);

const replacements = [
  // Double mojibake.
  [/\u00C3\u2021/g, '\u00C7'],
  [/\u00C3\u0192/g, '\u00C3'],

  // Lowercase Portuguese characters.
  [/\u00C3\u00A0/g, '\u00E0'],
  [/\u00C3\u00A1/g, '\u00E1'],
  [/\u00C3\u00A2/g, '\u00E2'],
  [/\u00C3\u00A3/g, '\u00E3'],
  [/\u00C3\u00A4/g, '\u00E4'],
  [/\u00C3\u00A7/g, '\u00E7'],

  [/\u00C3\u00A8/g, '\u00E8'],
  [/\u00C3\u00A9/g, '\u00E9'],
  [/\u00C3\u00AA/g, '\u00EA'],
  [/\u00C3\u00AB/g, '\u00EB'],

  [/\u00C3\u00AC/g, '\u00EC'],
  [/\u00C3\u00AD/g, '\u00ED'],
  [/\u00C3\u00AE/g, '\u00EE'],
  [/\u00C3\u00AF/g, '\u00EF'],

  [/\u00C3\u00B2/g, '\u00F2'],
  [/\u00C3\u00B3/g, '\u00F3'],
  [/\u00C3\u00B4/g, '\u00F4'],
  [/\u00C3\u00B5/g, '\u00F5'],
  [/\u00C3\u00B6/g, '\u00F6'],

  [/\u00C3\u00B9/g, '\u00F9'],
  [/\u00C3\u00BA/g, '\u00FA'],
  [/\u00C3\u00BB/g, '\u00FB'],
  [/\u00C3\u00BC/g, '\u00FC'],

  // Uppercase Portuguese characters.
  [/\u00C3\u0080/g, '\u00C0'],
  [/\u00C3\u0081/g, '\u00C1'],
  [/\u00C3\u0082/g, '\u00C2'],
  [/\u00C3\u0083/g, '\u00C3'],
  [/\u00C3\u0087/g, '\u00C7'],

  [/\u00C3\u0088/g, '\u00C8'],
  [/\u00C3\u0089/g, '\u00C9'],
  [/\u00C3\u008A/g, '\u00CA'],

  [/\u00C3\u008C/g, '\u00CC'],
  [/\u00C3\u008D/g, '\u00CD'],
  [/\u00C3\u008E/g, '\u00CE'],

  [/\u00C3\u0092/g, '\u00D2'],
  [/\u00C3\u0093/g, '\u00D3'],
  [/\u00C3\u0094/g, '\u00D4'],
  [/\u00C3\u0095/g, '\u00D5'],

  [/\u00C3\u0099/g, '\u00D9'],
  [/\u00C3\u009A/g, '\u00DA'],
  [/\u00C3\u009B/g, '\u00DB'],

  // Dashes and punctuation.
  [/\u00E2\u20AC\u201D/g, '\u2014'],
  [/\u00E2\u20AC\u201C/g, '\u2013'],
  [/\u00E2\u20AC\u2122/g, '\u2019'],
  [/\u00E2\u20AC\u02DC/g, '\u2018'],
  [/\u00E2\u20AC\u0153/g, '\u201C'],
  [/\u00E2\u20AC\u00A6/g, '\u2026'],

  // Symbols preceded by an incorrect A-circumflex.
  [/\u00C2\u00A0/g, ' '],
  [/\u00C2\u00BA/g, '\u00BA'],
  [/\u00C2\u00AA/g, '\u00AA'],
  [/\u00C2\u00B0/g, '\u00B0'],
];

async function collectFiles(
  directory,
) {
  const entries =
    await readdir(
      directory,
      {
        withFileTypes: true,
      },
    );

  const files = [];

  for (const entry of entries) {
    const fullPath =
      path.join(
        directory,
        entry.name,
      );

    if (entry.isDirectory()) {
      files.push(
        ...await collectFiles(
          fullPath,
        ),
      );

      continue;
    }

    const extension =
      path.extname(
        entry.name,
      ).toLowerCase();

    if (
      allowedExtensions.has(
        extension,
      )
    ) {
      files.push(
        fullPath,
      );
    }
  }

  return files;
}

function repairText(
  original,
) {
  let result =
    original;

  for (
    let pass = 0;
    pass < 4;
    pass += 1
  ) {
    const before =
      result;

    for (
      const [
        pattern,
        replacement,
      ] of replacements
    ) {
      result =
        result.replace(
          pattern,
          replacement,
        );
    }

    if (
      result === before
    ) {
      break;
    }
  }

  return result;
}

const suspiciousPatterns = [
  /\u00C3\u0192/u,
  /\u00C3\u2021/u,
  /\u00C3[\u0080-\u00BF]/u,
  /\u00E2\u20AC/u,
  /\u00C2[\u0080-\u00BF]/u,
  /\uFFFD/u,
];

const files =
  await collectFiles(
    root,
  );

const changedFiles = [];
const remainingProblems = [];

for (const file of files) {
  const original =
    await readFile(
      file,
      'utf8',
    );

  const repaired =
    repairText(
      original,
    );

  if (
    repaired !== original
  ) {
    await writeFile(
      file,
      repaired,
      'utf8',
    );

    changedFiles.push(
      path.relative(
        process.cwd(),
        file,
      ),
    );
  }

  const lines =
    repaired.split(
      /\r?\n/,
    );

  lines.forEach(
    (
      line,
      index,
    ) => {
      if (
        suspiciousPatterns.some(
          (pattern) =>
            pattern.test(
              line,
            ),
        )
      ) {
        remainingProblems.push({
          file:
            path.relative(
              process.cwd(),
              file,
            ),

          line:
            index + 1,

          content:
            line.trim(),
        });
      }
    },
  );
}

console.log('');
console.log(
  `Files changed: ${changedFiles.length}`,
);

for (
  const file of
  changedFiles
) {
  console.log(
    `- ${file}`,
  );
}

console.log('');

if (
  remainingProblems.length >
  0
) {
  console.error(
    'Suspicious sequences remain:',
  );

  for (
    const problem of
    remainingProblems
  ) {
    console.error(
      `${problem.file}:${problem.line} ${problem.content}`,
    );
  }

  process.exitCode =
    1;
} else {
  console.log(
    'No suspicious encoding sequences found.',
  );
}