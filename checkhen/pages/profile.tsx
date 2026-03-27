import { useEffect, useState } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import {
  Avatar,
  Box,
  Button,
  Card,
  Group,
  Stack,
  Text,
  Textarea,
  Title,
  useMantineTheme,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { GraduationCap, ArrowLeft, Save } from 'lucide-react';

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const theme = useMantineTheme();

  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [foodAllergies, setFoodAllergies] = useState('');
  const [saving, setSaving] = useState(false);
  const [backHref, setBackHref] = useState('/');

  useEffect(() => {
    if (status !== 'authenticated') return;

    fetch('/api/auth/is-admin')
      .then((r) => r.json())
      .then(({ isAdmin }) => {
        if (isAdmin) setBackHref('/admin/dashboard');
      });

    fetch('/api/student/get-profile')
      .then((r) => r.json())
      .then((data) => {
        setProfilePicture(data.profilePicture ?? null);
        setFoodAllergies(data.foodAllergies ?? '');
      })
      .catch(() => {
        notifications.show({ title: 'Error', message: 'Could not load profile', color: 'red' });
      });
  }, [status]);

  const handleSave = async () => {
    setSaving(true);
    const res = await fetch('/api/student/update-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ foodAllergies: foodAllergies || null }),
    });
    setSaving(false);

    if (res.ok) {
      notifications.show({ title: 'Saved', message: 'Profile updated successfully', color: 'green' });
    } else {
      notifications.show({ title: 'Error', message: 'Could not save profile', color: 'red' });
    }
  };

  if (status === 'loading') {
    return (
      <Box style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Text>Loading...</Text>
      </Box>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <Box
        style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `linear-gradient(135deg, ${theme.colors.buBlue[0]} 0%, ${theme.colors.warmRed[0]} 100%)`,
        }}
      >
        <Card shadow="lg" padding="xl" radius="md" style={{ maxWidth: 400, width: '100%' }}>
          <Stack align="center" gap="md">
            <GraduationCap size={40} color={theme.colors.buBlue[5]} />
            <Title order={2}>Sign in required</Title>
            <Button onClick={() => signIn('google')} size="lg" fullWidth>
              Sign In with Google
            </Button>
          </Stack>
        </Card>
      </Box>
    );
  }

  const email = session?.user?.email ?? '';

  return (
    <Box
      style={{
        minHeight: '100vh',
        background: `linear-gradient(135deg, ${theme.colors.buBlue[0]} 0%, ${theme.colors.warmRed[0]} 100%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.spacing.xl,
      }}
    >
      <Card shadow="lg" padding="xl" radius="md" style={{ maxWidth: 480, width: '100%' }}>
        <Stack gap="lg">
          <Group justify="space-between">
            <Title order={3}>My Profile</Title>
            <Button
              variant="subtle"
              size="sm"
              leftSection={<ArrowLeft size={16} />}
              onClick={() => router.push(backHref)}
            >
              Back
            </Button>
          </Group>

          {/* Avatar */}
          <Group gap="md">
            <Avatar src={profilePicture} size={80} radius="50%" />
            <div>
              <Text fw={600}>{email.split('@')[0]}</Text>
              <Text size="sm" c="dimmed">{email}</Text>
              <Text size="xs" c="dimmed" mt={4}>Profile picture synced from Google</Text>
            </div>
          </Group>

          {/* Food Allergies */}
          <Stack gap="xs">
            <Textarea
              label="Food Allergies"
              description="Let your instructor know about any food allergies (e.g. peanuts, dairy)"
              placeholder="None"
              value={foodAllergies}
              onChange={(e) => setFoodAllergies(e.currentTarget.value)}
              autosize
              minRows={2}
              maxRows={5}
            />
          </Stack>

          <Button
            leftSection={<Save size={16} />}
            onClick={handleSave}
            loading={saving}
          >
            Save Profile
          </Button>
        </Stack>
      </Card>
    </Box>
  );
}
