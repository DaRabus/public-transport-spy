'use client';

import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Grid } from '@mui/material';
import { PasswordElement, TextFieldElement } from 'react-hook-form-mui';
import { useUser } from '@hooks/use-user';
import { useRouter, useSearchParams } from 'next/navigation';
import { SEARCH_PARAMS_UNCACHED } from '@helpers/constants';
import { CustomSnackbar } from '@react-ui-kit/custom-snackbar';
import { useSnackbar } from '@hooks/use-snackbar';
import { getErrorMessage, SUCCESS_MESSAGES } from '@helpers/error-messages';

const LoginSchema = z.object({
  userName: z
    .string()
    .min(3, 'Username must be at least 3 characters long.')
    .max(20, 'Username must be at most 20 characters.'),
  password: z
    .string()
    .min(1, 'Password must be at least 1 characters long.')
    .max(50, 'Password is too long.')
});

type LoginFormData = z.infer<typeof LoginSchema>;

export function LoginForm() {
  const router = useRouter();
  const searchParameters = useSearchParams();
  const userName = searchParameters.get(SEARCH_PARAMS_UNCACHED.USERNAME);
  const { snackbar, showSuccess, showError, closeSnackbar } = useSnackbar();

  const { control, handleSubmit } = useForm<LoginFormData>({
    resolver: zodResolver(LoginSchema),
    defaultValues: {
      userName: userName ?? ''
    }
  });

  const { mutateLoginUser, isMutatingLoginUser, loginUserError, mutateUserLogin } = useUser();

  const onSubmit = async (formData: LoginFormData) => {
    try {
      await mutateLoginUser(formData);
      await mutateUserLogin();
      showSuccess(SUCCESS_MESSAGES.USER_LOGGED_IN);
      router.push('/');
      router.refresh();
    } catch (error_) {
      console.error('Error login user:', error_);
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
        {loginUserError && (
          <Grid size={{ xs: 12 }}>
            <Alert severity="error">{loginUserError.toString()}</Alert>
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
                type: 'password',
                autoComplete: 'current-password'
              }
            }}
            variant="outlined"
            size="small"
            fullWidth
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
          <Button loading={isMutatingLoginUser} type="submit" variant="contained" color="primary">
            Login
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
