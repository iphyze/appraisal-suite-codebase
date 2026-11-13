/** Shared PDF font registration. React-PDF embeds AppraisalSuite's local Montserrat faces. */
import { Font } from '@react-pdf/renderer';
import MontserratRegular from '../../assets/fonts/Montserrat/Montserrat-Regular.ttf';
import MontserratMedium from '../../assets/fonts/Montserrat/Montserrat-Medium.ttf';
import MontserratSemiBold from '../../assets/fonts/Montserrat/Montserrat-SemiBold.ttf';
import MontserratBold from '../../assets/fonts/Montserrat/Montserrat-Bold.ttf';

export const PDF_FONT_FAMILY = 'AppraisalSuiteMontserrat';

Font.register({
  family: PDF_FONT_FAMILY,
  fonts: [
    { src: MontserratRegular, fontWeight: 400 },
    { src: MontserratMedium, fontWeight: 500 },
    { src: MontserratSemiBold, fontWeight: 600 },
    { src: MontserratBold, fontWeight: 700 },
  ],
});
