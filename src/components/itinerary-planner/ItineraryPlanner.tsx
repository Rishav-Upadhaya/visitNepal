
"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { aiItineraryTool, type AiItineraryToolOutput, type AiItineraryToolInput } from '@/ai/flows/ai-itinerary-tool';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Route, CalendarDays, DollarSign, MapPinIcon, Sparkles, ListChecks, Info, FileText, Shuffle, Edit, Hotel, Download, MessageSquarePlus } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { nepalDistrictsByRegion, type DistrictName, budgetRanges } from '@/types';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { ScrollArea } from '@/components/ui/scroll-area';
import { logUserEvent } from '@/lib/logger'; // Import the logger


const formSchema = z.object({
  itineraryType: z.enum(["custom", "random"], { required_error: "Please select an itinerary type." }),
  interests: z.string().optional(),
  duration: z.coerce.number().min(1, { message: "Duration must be at least 1 day." }),
  budget: z.enum(Object.keys(budgetRanges) as [keyof typeof budgetRanges, ...(keyof typeof budgetRanges)[]] , { required_error: "Please select a budget range." }),
  startPoint: z.string({required_error: "Please select a starting point."}).min(1, { message: "Please select a starting point." }),
  endPoint: z.string().optional(), 
  mustVisitPlaces: z.string().optional(), 
}).refine(data => {
    if (data.itineraryType === 'custom' && (!data.interests || data.interests.length < 10)) {
      return false;
    }
    return true;
  }, {
    message: "Please describe your interests (min 10 characters) for a custom itinerary.",
    path: ["interests"],
  });

const modificationSchema = z.object({
    modificationRequest: z.string().min(10, "Please describe your desired changes (min 10 characters).").max(500, "Modification request is too long (max 500 characters).")
});


export function ItineraryPlanner() {
  const [itinerary, setItinerary] = useState<AiItineraryToolOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const itineraryRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [originalFormValues, setOriginalFormValues] = useState<z.infer<typeof formSchema> | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      itineraryType: "custom",
      interests: "",
      duration: 7,
      budget: undefined,
      startPoint: "Kathmandu",
      endPoint: "none", 
      mustVisitPlaces: "none",
    },
  });

  const modificationForm = useForm<z.infer<typeof modificationSchema>>({
      resolver: zodResolver(modificationSchema),
      defaultValues: {
          modificationRequest: "",
      }
  });

  const itineraryType = form.watch("itineraryType");

  useEffect(() => {
    if (itineraryType === 'random') {
      form.setValue('mustVisitPlaces', 'none');
      form.setValue('interests', '');
      form.clearErrors('interests');
    }
  }, [itineraryType, form]);


  const onSubmit = useCallback(async (values: z.infer<typeof formSchema>) => {
    setIsLoading(true);
    setError(null);
    setItinerary(null);
    setOriginalFormValues(values);

    logUserEvent({ 
      eventName: 'GenerateItineraryAttempt', 
      eventData: { 
        type: values.itineraryType, 
        duration: values.duration, 
        budget: values.budget,
        startPoint: values.startPoint,
        // Log other relevant non-sensitive form values
      } 
    });

    try {
      const budgetLabel = budgetRanges[values.budget];
      const payload: AiItineraryToolInput = {
        ...values,
        budget: budgetLabel,
        interests: values.itineraryType === 'custom' ? values.interests : undefined,
        endPoint: values.endPoint === "none" || !values.endPoint ? undefined : values.endPoint,
        mustVisitPlaces: values.itineraryType === 'custom' && values.mustVisitPlaces !== "none" && values.mustVisitPlaces ? values.mustVisitPlaces : undefined,
      };

      const result = await aiItineraryTool(payload);
      setItinerary(result);
      toast({
        title: "Itinerary Generated!",
        description: `Your ${values.itineraryType} travel plan is ready.`,
      });
      logUserEvent({ eventName: 'GenerateItinerarySuccess', eventData: { type: values.itineraryType, duration: values.duration } });
    } catch (e) {
      console.error(e);
      const errorMessage = e instanceof Error ? e.message : "Failed to generate itinerary. Please try again.";
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      logUserEvent({ eventName: 'GenerateItineraryFailure', eventData: { error: errorMessage } });
    } finally {
      setIsLoading(false);
    }
  }, [toast, form]); // Added form to dependencies

  const handleModifyItinerary = useCallback(async (modificationData: z.infer<typeof modificationSchema>) => {
    if (!itinerary || !originalFormValues) {
        toast({ title: "Error", description: "No itinerary to modify or original parameters missing.", variant: "destructive"});
        return;
    }
    setIsLoading(true);
    setError(null);
    logUserEvent({ eventName: 'ModifyItineraryAttempt', eventData: { requestLength: modificationData.modificationRequest.length }});

    try {
        const budgetLabel = budgetRanges[originalFormValues.budget];
        const payload: AiItineraryToolInput = {
            ...originalFormValues,
            budget: budgetLabel,
            previousItinerary: itinerary,
            modificationRequest: modificationData.modificationRequest,
            interests: originalFormValues.itineraryType === 'custom' ? originalFormValues.interests : undefined,
            endPoint: originalFormValues.endPoint === "none" || !originalFormValues.endPoint ? undefined : originalFormValues.endPoint,
            mustVisitPlaces: originalFormValues.itineraryType === 'custom' && originalFormValues.mustVisitPlaces !== "none" && originalFormValues.mustVisitPlaces ? originalFormValues.mustVisitPlaces : undefined,
        };

        const result = await aiItineraryTool(payload);
        setItinerary(result);
        modificationForm.reset();
        toast({
            title: "Itinerary Modified!",
            description: "Your travel plan has been updated based on your request.",
        });
        logUserEvent({ eventName: 'ModifyItinerarySuccess' });
    } catch (e) {
        console.error("Modification error:", e);
        const errorMessage = e instanceof Error ? e.message : "Failed to modify itinerary.";
        setError(errorMessage);
        toast({
            title: "Modification Error",
            description: errorMessage,
            variant: "destructive",
        });
        logUserEvent({ eventName: 'ModifyItineraryFailure', eventData: { error: errorMessage } });
    } finally {
        setIsLoading(false);
    }
  }, [itinerary, originalFormValues, modificationForm, toast]);


  const handleExportPdf = useCallback(async () => {
    if (!itineraryRef.current) {
      console.error("Itinerary element not found for export.");
      toast({ title: "Export Error", description: "Could not find itinerary to export.", variant: "destructive" });
      return;
    }
    setIsExporting(true);
    logUserEvent({ eventName: 'ExportPdfAttempt' });
    toast({ title: "Exporting PDF...", description: "Please wait." });
    try {
      const canvas = await html2canvas(itineraryRef.current, {
         scale: 2,
         useCORS: true,
         logging: false,
         backgroundColor: null, 
         scrollX: 0,
         scrollY: -window.scrollY,
         windowWidth: itineraryRef.current.scrollWidth, 
         windowHeight: itineraryRef.current.scrollHeight 
      });

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4',
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const pdfMargin = 30; 
      const contentWidth = pdfWidth - (pdfMargin * 2);
      
      const imgProps = pdf.getImageProperties(canvas);
      const imgWidth = imgProps.width;
      const imgHeight = imgProps.height;
      const ratio = contentWidth / imgWidth;
      const scaledImgHeight = imgHeight * ratio;

      let currentImagePartY = 0; 

      while (currentImagePartY < scaledImgHeight) {
        if (currentImagePartY > 0) { 
          pdf.addPage();
        }
        const partHeight = Math.min(pdfHeight - (pdfMargin * 2), scaledImgHeight - currentImagePartY);
        
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = imgWidth; 
        tempCanvas.height = partHeight / ratio;
        const tempCtx = tempCanvas.getContext('2d');

        if (tempCtx) {
          tempCtx.drawImage(
            canvas,
            0, 
            currentImagePartY / ratio, 
            imgWidth, 
            partHeight / ratio, 
            0, 
            0, 
            imgWidth,
            partHeight / ratio 
          );
          pdf.addImage(tempCanvas.toDataURL('image/png'), 'PNG', pdfMargin, pdfMargin, contentWidth, partHeight);
        }
        currentImagePartY += partHeight;
      }

      pdf.save('nepal-itinerary.pdf');
      toast({ title: "Export Successful!", description: "Your itinerary has been saved as a PDF." });
      logUserEvent({ eventName: 'ExportPdfSuccess' });
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast({ title: "Export Failed", description: `Could not generate the PDF. ${error instanceof Error ? error.message : 'Unknown error'}`, variant: "destructive" });
      logUserEvent({ eventName: 'ExportPdfFailure', eventData: { error: error instanceof Error ? error.message : 'Unknown error' } });
    } finally {
      setIsExporting(false);
    }
  }, [toast]);


  return (
    <div className="container py-12 md:py-16">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight text-primary">AI-Powered Itinerary Builder</h1>
        <p className="mt-3 text-lg text-muted-foreground max-w-2xl mx-auto">
          Choose your style: craft a detailed custom trip or let AI surprise you with a random adventure!
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-1 space-y-8 lg:sticky top-24"> {/* Added lg:sticky and top-24 for sticky sidebar on large screens */}
            {/* Form Card */}
            <Card className="shadow-xl border border-primary/20">
                <CardHeader className="bg-primary/5 p-4 md:p-6">
                    <CardTitle className="flex items-center gap-2 text-primary text-xl md:text-2xl"><Route className="h-6 w-6 md:h-7 md:w-7" /> Plan Your Trip</CardTitle>
                    <CardDescription className="text-sm md:text-base">Select your preferences below.</CardDescription>
                </CardHeader>
                <CardContent className="p-4 md:p-6">
                    <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 md:space-y-6">
                        <FormField
                        control={form.control}
                        name="itineraryType"
                        render={({ field }) => (
                            <FormItem className="space-y-2 md:space-y-3">
                            <FormLabel className="font-semibold text-sm md:text-base">Choose Itinerary Type</FormLabel>
                            <FormControl>
                                <RadioGroup
                                onValueChange={field.onChange}
                                value={field.value}
                                className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4"
                                >
                                <FormItem className="flex items-center space-x-2 space-y-0">
                                    <FormControl>
                                    <RadioGroupItem value="custom" id="custom" />
                                    </FormControl>
                                    <FormLabel htmlFor="custom" className="font-medium text-sm md:text-base flex items-center gap-1.5 cursor-pointer">
                                    <Edit className="h-4 w-4"/> Custom Plan
                                    </FormLabel>
                                </FormItem>
                                <FormItem className="flex items-center space-x-2 space-y-0">
                                    <FormControl>
                                    <RadioGroupItem value="random" id="random" />
                                    </FormControl>
                                    <FormLabel htmlFor="random" className="font-medium text-sm md:text-base flex items-center gap-1.5 cursor-pointer">
                                        <Shuffle className="h-4 w-4"/> Random Adventure
                                    </FormLabel>
                                </FormItem>
                                </RadioGroup>
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                         <FormField
                            control={form.control}
                            name="startPoint"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel className="font-semibold text-sm md:text-base">Starting Point</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value || undefined} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger className="h-10 md:h-11 text-sm md:text-base">
                                            <SelectValue placeholder="Select starting district" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {Object.entries(nepalDistrictsByRegion).map(([region, districts]) => (
                                            <SelectGroup key={region}>
                                                <SelectLabel className="font-bold text-xs md:text-sm">{region}</SelectLabel>
                                                {districts.map(d => (
                                                    <SelectItem key={d} value={d} className="text-sm md:text-base">{d}</SelectItem>
                                                ))}
                                            </SelectGroup>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="endPoint"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel className="font-semibold text-sm md:text-base">Ending Point (Optional)</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value || "none"} defaultValue={field.value || "none"}>
                                    <FormControl>
                                        <SelectTrigger className="h-10 md:h-11 text-sm md:text-base">
                                            <SelectValue placeholder="Select ending district" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="none" className="text-sm md:text-base italic">Default (Based on Itinerary)</SelectItem>
                                        {Object.entries(nepalDistrictsByRegion).map(([region, districts]) => (
                                            <SelectGroup key={region}>
                                                <SelectLabel className="font-bold text-xs md:text-sm">{region}</SelectLabel>
                                                {districts.map(d => (
                                                    <SelectItem key={d} value={d} className="text-sm md:text-base">{d}</SelectItem>
                                                ))}
                                            </SelectGroup>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="duration"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="font-semibold text-sm md:text-base">Duration (days)</FormLabel>
                                    <FormControl>
                                    <Input type="number" {...field} className="h-10 md:h-11 text-sm md:text-base"/>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="budget"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="font-semibold text-sm md:text-base">Budget (Total Trip)</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value || undefined} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger className="h-10 md:h-11 text-sm md:text-base">
                                        <SelectValue placeholder="Select budget range" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {Object.entries(budgetRanges).map(([key, label]) => (
                                            <SelectItem key={key} value={key} className="text-sm md:text-base">{label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                        </div>
                        {itineraryType === 'custom' && (
                        <>
                            <FormField
                            control={form.control}
                            name="interests"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel className="font-semibold text-sm md:text-base">Your Interests</FormLabel>
                                <FormControl>
                                    <Textarea
                                    placeholder="e.g., trekking in Annapurna, exploring ancient temples in Kathmandu, spotting wildlife in Chitwan..."
                                    className="min-h-[80px] md:min-h-[100px] text-sm md:text-base"
                                    {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                             <FormField
                                control={form.control}
                                name="mustVisitPlaces"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="font-semibold text-sm md:text-base">Must-Visit Places/Regions (Optional)</FormLabel>
                                     <Select onValueChange={field.onChange} value={field.value || "none"} defaultValue={field.value || "none"}>
                                        <FormControl>
                                            <SelectTrigger className="h-10 md:h-11 text-sm md:text-base">
                                                <SelectValue placeholder="Select must-visit district" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="none" className="text-sm md:text-base italic">None (Let AI Suggest)</SelectItem>
                                            {Object.entries(nepalDistrictsByRegion).map(([region, districts]) => (
                                                <SelectGroup key={region}>
                                                    <SelectLabel className="font-bold text-xs md:text-sm">{region}</SelectLabel>
                                                    {districts.map(d => (
                                                        <SelectItem key={d} value={d} className="text-sm md:text-base">{d}</SelectItem>
                                                    ))}
                                                </SelectGroup>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                        </>
                        )}
                        <Button type="submit" disabled={isLoading || isExporting} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground text-base md:text-lg py-2.5 md:py-3 h-auto">
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 md:h-5 md:w-5 animate-spin" />}
                        {isLoading ? "Generating..." : (itineraryType === 'custom' ? "Generate Custom Itinerary" : "Generate Random Adventure")}
                        <Sparkles className="ml-2 h-4 w-4 md:h-5 md:w-5" />
                        </Button>
                    </form>
                    </Form>
                </CardContent>
            </Card>

            {/* Modification Card - appears only when itinerary is generated */}
             {itinerary && itinerary.itinerary.length > 0 && !isLoading && (
                <Card className="shadow-xl border">
                    <CardHeader className="bg-muted/50 p-4 md:p-6">
                        <CardTitle className="text-lg md:text-xl flex items-center gap-2 text-primary">
                            <MessageSquarePlus className="h-6 w-6 md:h-7 md:w-7"/> Want to Change Something?
                        </CardTitle>
                        <CardDescription className="text-sm md:text-base mt-1">
                            Suggest modifications to your itinerary below (e.g., "Spend one more day in Pokhara", "I prefer hiking over city tours on day 2").
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 md:p-6">
                        <Form {...modificationForm}>
                            <form onSubmit={modificationForm.handleSubmit(handleModifyItinerary)} className="space-y-4">
                                <FormField
                                    control={modificationForm.control}
                                    name="modificationRequest"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="font-semibold text-sm md:text-base">Your Modification Request</FormLabel>
                                            <FormControl>
                                                <Textarea
                                                    placeholder="Tell us what you'd like to change..."
                                                    className="min-h-[80px] md:min-h-[100px] text-sm md:text-base"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <Button type="submit" disabled={isLoading || isExporting} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-base md:text-lg py-2.5 md:py-3 h-auto">
                                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 md:h-5 md:w-5 animate-spin" /> : <Edit className="mr-2 h-4 w-4 md:h-5 md:w-5" />}
                                    {isLoading ? "Applying Changes..." : "Apply Changes"}
                                </Button>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
            )}
        </div>

        {/* Itinerary Display Column */}
        <div className="lg:col-span-2 mt-8 lg:mt-0">
          {isLoading && (
             <Card className="shadow-xl flex flex-col items-center justify-center min-h-[300px] md:min-h-[400px] text-center bg-muted/30 border">
              <Loader2 className="h-12 w-12 md:h-16 md:w-16 text-primary animate-spin mx-auto mb-4 md:mb-6" />
              <CardTitle className="text-xl md:text-2xl text-primary">Generating Your Itinerary...</CardTitle>
              <CardDescription className="text-base md:text-lg mt-2">
                Please wait while our AI crafts your personalized adventure!
              </CardDescription>
            </Card>
          )}
          {error && !isLoading && (
            <Alert variant="destructive" className="mb-6">
              <Info className="h-4 w-4" />
              <AlertTitle>Error Generating Itinerary</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Itinerary Card */}
          {itinerary && itinerary.itinerary.length > 0 && !isLoading && (
            <Card className="shadow-xl border">
              <CardHeader className="bg-primary/5 p-4 md:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4">
                <div>
                  <CardTitle className="text-xl md:text-2xl flex items-center gap-2 text-primary">
                    <ListChecks className="h-7 w-7 md:h-8 md:w-8"/> Your {originalFormValues?.itineraryType === 'custom' ? 'Custom' : 'Random'} Itinerary
                  </CardTitle>
                  <CardDescription className="text-sm md:text-base mt-1">Here's a day-by-day plan for your adventure in Nepal.</CardDescription>
                </div>
                <Button onClick={handleExportPdf} disabled={isExporting || isLoading} variant="outline" className="w-full sm:w-auto text-sm md:text-base py-2 h-auto">
                  {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                  {isExporting ? "Exporting..." : "Export PDF"}
                </Button>
              </CardHeader>
               <div ref={itineraryRef} className="bg-background">
                 <ScrollArea className="w-full rounded-b-md max-h-[calc(100vh-200px)] md:max-h-[calc(100vh-250px)] overflow-y-auto"> {/* Adjusted max-height to be responsive */}
                  <CardContent className="p-4 md:p-6 space-y-4 md:space-y-6 print:p-4"> 
                    <div className="p-4 border rounded-lg bg-muted/50 text-center hidden print:block">
                        <h3 className="text-lg font-semibold text-primary mb-2">VisitNepal Itinerary</h3>
                        <p className="text-muted-foreground text-sm">Generated for {originalFormValues?.duration} days, starting from {originalFormValues?.startPoint}. Budget: {originalFormValues?.budget ? budgetRanges[originalFormValues.budget] : 'N/A'}.</p>
                    </div>
                    {itinerary.itinerary.map((dayPlan, index) => (
                    <div key={index} className="relative pl-6 md:pl-8 group print:pl-6">
                        <span className="absolute left-[-2px] top-1 flex items-center justify-center w-7 h-7 md:w-9 md:h-9 rounded-full bg-primary text-primary-foreground font-bold text-xs md:text-base shadow z-10 print:bg-gray-700 print:text-white print:w-7 print:h-7 print:text-xs print:left-[-2px]">
                        {dayPlan.day}
                        </span>
                        {index < itinerary.itinerary.length - 1 && (
                            <div className="absolute left-[10px] md:left-[14px] top-8 md:top-10 bottom-[-1rem] md:bottom-[-1.5rem] w-0.5 bg-border group-last:hidden print:bg-gray-300 print:left-[10px] print:bottom-[-1rem]" />
                        )}
                        <Card className="ml-3 md:ml-4 bg-card border-l-2 md:border-l-4 border-accent shadow-md hover:shadow-lg transition-shadow print:shadow-none print:border-l-2 print:border-gray-400 print:ml-3 print:border-accent">
                        <CardHeader className="p-3 md:p-4 print:p-3">
                            <CardTitle className="text-base md:text-lg flex items-center gap-1.5 md:gap-2 print:text-base print:gap-1.5">
                                <MapPinIcon className="h-4 w-4 md:h-5 md:w-5 text-accent print:h-4 print:w-4 print:text-gray-600" /> {dayPlan.location}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 md:p-4 pt-0 space-y-2 md:space-y-3 print:p-3 print:pt-0 print:space-y-2">
                            <div>
                                <h4 className="font-semibold mb-1 text-foreground/90 text-xs md:text-sm print:text-xs print:mb-0.5">Activities:</h4>
                                <ul className="list-disc pl-4 md:pl-5 space-y-0.5 md:space-y-1 text-muted-foreground text-xs md:text-sm print:text-xs print:space-y-0.5">
                                {dayPlan.activities?.map((activity, actIndex) => (
                                    <li key={actIndex}>{activity}</li>
                                ))}
                                {(!dayPlan.activities || dayPlan.activities.length === 0) && (
                                    <li className="italic">No specific activities listed for today.</li>
                                )}
                                </ul>
                            </div>
                            {dayPlan.hotelRecommendations && dayPlan.hotelRecommendations.length > 0 && (
                                <div>
                                    <Separator className="my-1.5 md:my-2 print:my-1.5" />
                                    <h4 className="font-semibold mb-1 text-foreground/90 text-xs md:text-sm flex items-center gap-1 print:text-xs print:mb-0.5">
                                        <Hotel className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary print:h-3.5 print:w-3.5 print:text-gray-700" /> Hotel Recommendations:
                                    </h4>
                                    <ul className="list-disc pl-4 md:pl-5 space-y-0.5 md:space-y-1 text-muted-foreground text-xs md:text-sm print:text-xs print:space-y-0.5">
                                    {dayPlan.hotelRecommendations.map((hotel, hotelIndex) => (
                                        <li key={hotelIndex}>{hotel}</li>
                                    ))}
                                    </ul>
                                </div>
                            )}
                        </CardContent>
                        </Card>
                    </div>
                    ))}
                  </CardContent>
                </ScrollArea>
             </div>
            </Card>
          )}

          {/* Empty / Placeholder States */}
          {itinerary && itinerary.itinerary.length === 0 && !isLoading && (
             <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Itinerary Could Not Be Generated</AlertTitle>
                <AlertDescription>The AI could not generate an itinerary based on your inputs. Please try adjusting your preferences.</AlertDescription>
              </Alert>
          )}
          {!isLoading && !itinerary && !error && (
             <Card className="shadow-xl flex flex-col items-center justify-center min-h-[300px] md:min-h-[400px] text-center bg-muted/30 border">
              <CardHeader>
                <Route className="h-12 w-12 md:h-16 md:w-16 text-primary mx-auto mb-4 md:mb-6" />
                <CardTitle className="text-xl md:text-2xl">Ready for an Adventure?</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base md:text-lg">
                  Choose 'Custom Plan' or 'Random Adventure' on the left and let AI craft your Nepal itinerary!
                </CardDescription>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
