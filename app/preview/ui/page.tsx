import type { Metadata } from 'next';
import { ChevronDown, Plane } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Internal reference page for the shadcn/ui components in components/ui,
// themed with the site's tokens (app/globals.css). Not linked, not indexed.
export const metadata: Metadata = {
  title: 'UI components — preview',
  robots: { index: false, follow: false },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-forest-900">{title}</h2>
      <div className="flex flex-wrap items-start gap-3">{children}</div>
    </section>
  );
}

export default function UiPreviewPage() {
  return (
    <main className="mx-auto max-w-5xl space-y-10 px-4 py-10" data-testid="ui-preview">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-forest-900">UI components</h1>
        <p className="text-muted-foreground">
          shadcn/ui components from <code>components/ui</code>, using the Originfacts colours and 0.3rem corners.
        </p>
      </header>

      <Section title="Button">
        <Button>Search flights</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="link">Link</Button>
        <Button variant="destructive">Remove</Button>
        <Button size="icon" aria-label="Flights">
          <Plane />
        </Button>
        <Button disabled>Disabled</Button>
      </Section>

      <Section title="Badge">
        <Badge>Direct</Badge>
        <Badge variant="secondary">Popular</Badge>
        <Badge variant="outline">1 stop</Badge>
        <Badge variant="destructive">Ceased</Badge>
      </Section>

      <Section title="Card">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Perth to Bali</CardTitle>
            <CardDescription>Example card layout.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm">Card body text sits here.</CardContent>
          <CardFooter>
            <Button className="w-full">View route</Button>
          </CardFooter>
        </Card>
      </Section>

      <Section title="Form controls">
        <div className="grid w-full max-w-sm gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="ui-email">Email</Label>
            <Input id="ui-email" type="email" placeholder="you@example.com" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ui-message">Message</Label>
            <Textarea id="ui-message" placeholder="Your message" />
          </div>
          <div className="grid gap-1.5">
            <Label>Currency</Label>
            <Select defaultValue="AUD">
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AUD">$ AUD</SelectItem>
                <SelectItem value="USD">$ USD</SelectItem>
                <SelectItem value="GBP">£ GBP</SelectItem>
                <SelectItem value="EUR">€ EUR</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="ui-direct" />
            <Label htmlFor="ui-direct">Direct flights only</Label>
          </div>
        </div>
      </Section>

      <Section title="Tabs">
        <Tabs defaultValue="flights" className="w-full max-w-md">
          <TabsList>
            <TabsTrigger value="flights">Flights</TabsTrigger>
            <TabsTrigger value="hotels">Hotels</TabsTrigger>
          </TabsList>
          <TabsContent value="flights" className="text-sm">Flights tab content.</TabsContent>
          <TabsContent value="hotels" className="text-sm">Hotels tab content.</TabsContent>
        </Tabs>
      </Section>

      <Section title="Accordion">
        <Accordion type="single" collapsible className="w-full max-w-md">
          <AccordionItem value="a">
            <AccordionTrigger>First question</AccordionTrigger>
            <AccordionContent>First answer.</AccordionContent>
          </AccordionItem>
          <AccordionItem value="b">
            <AccordionTrigger>Second question</AccordionTrigger>
            <AccordionContent>Second answer.</AccordionContent>
          </AccordionItem>
        </Accordion>
      </Section>

      <Section title="Overlays">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Open dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dialog title</DialogTitle>
              <DialogDescription>Dialog body text.</DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline">Open sheet</Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Menu</SheetTitle>
              <SheetDescription>Slide-over panel, e.g. a mobile menu.</SheetDescription>
            </SheetHeader>
          </SheetContent>
        </Sheet>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              Topics <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Topics</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Flights</DropdownMenuItem>
            <DropdownMenuItem>Hotels</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">Open popover</Button>
          </PopoverTrigger>
          <PopoverContent className="text-sm">Popover content.</PopoverContent>
        </Popover>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline">Hover for tooltip</Button>
            </TooltipTrigger>
            <TooltipContent>Tooltip text</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </Section>

      <Section title="Separator and skeleton">
        <div className="w-full max-w-md space-y-4">
          <Separator />
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        </div>
      </Section>
    </main>
  );
}
