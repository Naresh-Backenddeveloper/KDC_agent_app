/** Every screen renders, inside real navigation, from the demo data. */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SCREENS } from '../src/navigation/RootNavigator';
import { resetMockDb } from '../src/api/mockServer';
import { useSession } from '../src/store/session';

jest.setTimeout(30000);

const PARAMS: Record<string, object> = {
  otp: { mobile: '9876543210' },
  'test-details': { bookingId: 'KDC-HC-10415' },
  sample: { bookingId: 'KDC-HC-10415', patientKey: 'other-502' },
  'collect-payment': { bookingId: 'KDC-HC-10418', mode: 'booking', completeAfter: true },
  'booking-details': { bookingId: 'KDC-HC-10421' },
  policy: { path: 'privacy-policy', title: 'Privacy Policy' },
};

const Stack = createNativeStackNavigator();

beforeAll(() => {
  resetMockDb();
  useSession.setState({ token: 'test-token' });
});

it('registers the 13 screens (spec’s 14 minus the removed wallet)', () => {
  expect(SCREENS).toHaveLength(13);
});

for (const s of SCREENS) {
  it(`${s.name} renders`, async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name={s.name} component={s.component} initialParams={PARAMS[s.name]} />
          </Stack.Navigator>
        </NavigationContainer>,
      );
      await new Promise<void>((r) => setTimeout(r, 900));
    });
    expect(tree!.toJSON()).toBeTruthy();
    await ReactTestRenderer.act(async () => tree!.unmount());
  });
}
