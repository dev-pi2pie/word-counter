import pc from "picocolors";
import { createDoctorReport } from "./checks";
import { renderDoctorReport } from "./render";
import type { DoctorOutputFormat, DoctorRuntimeOverrides } from "./types";

type ExecuteDoctorCommandOptions = {
  argv: string[];
  runtime?: DoctorRuntimeOverrides;
};

type ValidDoctorInvocation =
  | {
      ok: true;
      format: DoctorOutputFormat;
      pretty: boolean;
    }
  | {
      ok: false;
      message: string;
    };

function parseDoctorFormat(rawValue: string | undefined): DoctorOutputFormat | null {
  if (rawValue === undefined) {
    return "standard";
  }
  if (rawValue === "json") {
    return "json";
  }
  return null;
}

function validateDoctorInvocation(argv: string[]): ValidDoctorInvocation {
  const doctorIndex = argv.findIndex((token, index) => index >= 2 && token === "doctor");
  const tokens = doctorIndex >= 0 ? argv.slice(doctorIndex + 1) : [];
  let expectsFormatValue = false;
  let format: DoctorOutputFormat = "standard";
  let pretty = false;

  for (const token of tokens) {
    if (expectsFormatValue) {
      const parsedFormat = parseDoctorFormat(token);
      if (parsedFormat === null) {
        return {
          ok: false,
          message: "`doctor` only supports default text output or `--format json`.",
        };
      }
      format = parsedFormat;
      expectsFormatValue = false;
      continue;
    }

    if (token === "--") {
      return {
        ok: false,
        message: "`doctor` does not accept positional inputs.",
      };
    }

    if (token === "--format") {
      expectsFormatValue = true;
      continue;
    }

    if (token.startsWith("--format=")) {
      const rawValue = token.slice("--format=".length);
      if (rawValue.length === 0) {
        return {
          ok: false,
          message: "`--format` requires a value.",
        };
      }
      const parsedFormat = parseDoctorFormat(rawValue);
      if (parsedFormat === null) {
        return {
          ok: false,
          message: "`doctor` only supports default text output or `--format json`.",
        };
      }
      format = parsedFormat;
      continue;
    }

    if (token === "--pretty") {
      pretty = true;
      continue;
    }

    if (token.startsWith("-")) {
      return {
        ok: false,
        message: `\`${token}\` is not supported by \`doctor\`.`,
      };
    }

    return {
      ok: false,
      message: "`doctor` does not accept positional inputs.",
    };
  }

  if (expectsFormatValue) {
    return {
      ok: false,
      message: "`--format` requires a value.",
    };
  }

  if (pretty && format !== "json") {
    return {
      ok: false,
      message: "`--pretty` requires `--format json`.",
    };
  }

  return {
    ok: true,
    format,
    pretty,
  };
}

export async function executeDoctorCommand({
  argv,
  runtime,
}: ExecuteDoctorCommandOptions): Promise<void> {
  const validated = validateDoctorInvocation(argv);
  if (!validated.ok) {
    console.error(pc.red(`error: ${validated.message}`));
    process.exitCode = 1;
    return;
  }

  const report = await createDoctorReport(runtime);
  renderDoctorReport(report, {
    format: validated.format,
    pretty: validated.pretty,
  });
  process.exitCode = report.status === "fail" ? 2 : 0;
}
