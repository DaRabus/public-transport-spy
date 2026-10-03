'use client';

import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Grid } from '@mui/material';
import { PasswordElement, PasswordRepeatElement, TextFieldElement } from 'react-hook-form-mui';
import { useUser } from '@hooks/use-user';
import { useRouter } from 'next/navigation';
import { CustomSnackbar } from '@react-ui-kit/custom-snackbar';
import { useSnackbar } from '@hooks/use-snackbar';
import { getErrorMessage, SUCCESS_MESSAGES } from '@helpers/error-messages';

const USERNAME_PATTERN = /^[a-z0-9_.-]{3,32}$/;

const RegisterSchema = z
  .object({
    userName: z
      .string()
      .regex(
        USERNAME_PATTERN,
        'Username must be 3-32 characters: lowercase letters, numbers, _ . -'
      ),
    password: z
      .string()
      .min(6, 'Password must be at least 6 characters long.')
      .max(72, 'Password is too long.'),
    passwordRepeat: z
      .string()
      .min(6, 'Password must be at least 6 characters long.')
      .max(72, 'Password is too long.')
  })
  .refine((data) => data.password === data.passwordRepeat, {
    message: 'Passwords do not match',
    path: ['passwordRepeat']
  });

type RegisterFormData = z.infer<typeof RegisterSchema>;

export function RegistrationForm() {
  const router = useRouter();
  const { snackbar, showSuccess, showError, closeSnackbar } = useSnackbar();

  const { control, handleSubmit } = useForm<RegisterFormData>({
    resolver: zodResolver(RegisterSchema)
  });

  const { mutateRegisterUser, isMutatingRegisterUser, registerUserError, mutateUserLogin } =
    useUser();

  const onSubmit = async (formData: RegisterFormData) => {
    try {
      await mutateRegisterUser(formData);
      await mutateUserLogin();
      showSuccess(SUCCESS_MESSAGES.USER_REGISTERED);
      router.push('/');
      router.refresh();
    } catch (error_) {
      console.error('Error registering user:', error_);
      showError(getErrorMessage(error_));
    }
  };

  return (
    <form onSubmit={handleSubmit((data) => onSubmit(data))}>
      <Grid
        container
        spacing={2}
        sx={{
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {registerUserError && (
          <Grid size={{ xs: 12 }}>
            <Alert severity="error">{getErrorMessage(registerUserError)}</Alert>
          </Grid>
        )}
        <Grid size={{ xs: 12 }}>
          <TextFieldElement
            control={control}
            required
            name="userName"
            label="Username"
            variant="outlined"
            fullWidth
            size="small"
          />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <PasswordElement
            control={control}
            margin="dense"
            label="Password"
            required
            name="password"
            slotProps={{
              htmlInput: {
                autoComplete: 'new-password'
              }
            }}
            variant="outlined"
            size="small"
            fullWidth
          />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <PasswordRepeatElement
            control={control}
            variant="outlined"
            size="small"
            fullWidth
            passwordFieldName="password"
            name="passwordRepeat"
            margin="dense"
            label="Repeat Password"
            required
          />
        </Grid>
        <Grid
          size={{ xs: 8 }}
          sx={{
            display: 'flex',
            alignContent: 'center',
            justifyContent: 'center',
            my: 2
          }}
        >
          <Button
            loading={isMutatingRegisterUser}
            type="submit"
            variant="contained"
            color="primary"
          >
            Register
          </Button>
        </Grid>
      </Grid>
      <CustomSnackbar
        open={snackbar.open}
        message={snackbar.message}
        severity={snackbar.severity}
        onClose={closeSnackbar}
      />
    </form>
  );
}
