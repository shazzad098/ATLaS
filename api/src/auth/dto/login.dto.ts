import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsNotEmpty, IsString, MaxLength, MinLength } from "class-validator";

/**
 * Phone/email + password sign-in (FR-01).
 *
 * The global ValidationPipe runs with `whitelist` + `forbidNonWhitelisted`, so
 * unknown fields are rejected instead of silently ignored, and `transform` trims
 * the identifier before it reaches the service.
 */
export class LoginDto {
  @ApiProperty({
    description: "Bangladeshi phone number or account email",
    examples: ["+8801700000000", "admin@atlas.example"],
    maxLength: 160,
  })
  @Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value))
  @IsString({ message: "identifier must be a string" })
  @IsNotEmpty({ message: "Phone or email is required" })
  @MaxLength(160)
  identifier!: string;

  @ApiProperty({ description: "Account password", minLength: 8, maxLength: 128 })
  @IsString({ message: "password must be a string" })
  @IsNotEmpty({ message: "Password is required" })
  @MinLength(8, { message: "Password must be at least 8 characters" })
  @MaxLength(128)
  password!: string;
}
