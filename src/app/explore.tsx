// This file is intentionally kept as a redirect.
// The Expo default template left this here; our app has no "explore" route.
import { Redirect } from 'expo-router';
export default function ExploreRedirect() {
  return <Redirect href="/" />;
}
