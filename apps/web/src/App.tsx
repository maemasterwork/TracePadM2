import { BrowserRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { AuthProvider } from './auth/AuthProvider';
import { I18nProvider } from './i18n';
import { Home } from './pages/Home';
import { AuthPagesLazy } from './pages/lazy';
import { Layout } from './pages/Layout';
import { LessonPage } from './pages/LessonPage';
import { NotFound } from './pages/NotFound';
import { Notes } from './pages/Notes';
import { Notifications } from './pages/Notifications';
import { ClassPage, Classes } from './pages/Classes';
import { OrgAdmin } from './pages/OrgAdmin';
import { Teach } from './pages/Teach';
import { TeachClass } from './pages/TeachClass';
import { TeachReview } from './pages/TeachReview';
import { Search } from './pages/Search';
import { Profile } from './pages/Profile';
import { ProgressPage } from './pages/ProgressPage';
import { Review } from './pages/Review';
import { Settings } from './pages/Settings';
import { RunnerProvider } from './runner/RunnerProvider';
import { Gate } from './teach/hooks';

function SignedInRequired({ children }: { children: ReactNode }) {
  return (
    <Gate need="signedIn" titleKey="lesson.accessTitle" guestKey="lesson.accessGuest" noServerKey="lesson.accessNoServer">
      {children}
    </Gate>
  );
}

export function App() {
  const { SignIn, SignUp, Reset, UpdatePassword } = AuthPagesLazy;
  return (
    <I18nProvider>
      <AuthProvider>
        <RunnerProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<Home />} />
                <Route path="lesson/:lessonId" element={<SignedInRequired><LessonPage /></SignedInRequired>} />
                <Route path="lesson/:lessonId/:chapterId" element={<SignedInRequired><LessonPage /></SignedInRequired>} />
                <Route path="signin" element={<SignIn />} />
                <Route path="signup" element={<SignUp />} />
                <Route path="reset" element={<Reset />} />
                <Route path="auth/update-password" element={<UpdatePassword />} />
                <Route path="search" element={<SignedInRequired><Search /></SignedInRequired>} />
                <Route path="notes" element={<Notes />} />
                <Route path="review" element={<Review />} />
                <Route path="progress" element={<ProgressPage />} />
                <Route path="classes" element={<Classes />} />
                <Route path="classes/:classId" element={<ClassPage />} />
                <Route path="teach" element={<Teach />} />
                <Route path="teach/org/:orgId" element={<OrgAdmin />} />
                <Route path="teach/:classId" element={<TeachClass />} />
                <Route path="teach/:classId/review/:assignmentId/:studentId" element={<TeachReview />} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="account" element={<Profile />} />
                <Route path="settings" element={<Settings />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </RunnerProvider>
      </AuthProvider>
    </I18nProvider>
  );
}
